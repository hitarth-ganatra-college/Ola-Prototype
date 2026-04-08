import "dotenv/config";
import express from "express";
import { Kafka } from "kafkajs";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import { TOPICS, REDIS_KEYS } from "../../../shared/topics.js";

const app = express();
app.use(express.json());

const kafka = new Kafka({
  clientId: "matching-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:29092").split(","),
  retry: { retries: 10, initialRetryTime: 1000 },
});
const producer = kafka.producer();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

app.get("/health", (_req, res) => res.json({ ok: true, service: "matching-service" }));

const rideRequestLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many ride requests. Please wait before trying again." },
  keyGenerator: (req) => req.body?.rider_id || req.ip,
});

/**
 * POST /request-ride
 * Body: { rider_id, lat, lng, radius_km? }
 * Returns nearest 3 drivers and emits ride-requested event to Kafka
 */
app.post("/request-ride", rideRequestLimiter, async (req, res) => {
  const { rider_id, lat, lng, radius_km = 5 } = req.body;
  if (!rider_id || lat == null || lng == null) {
    return res.status(400).json({ error: "rider_id, lat, lng required" });
  }

  try {
    // Find nearest 3 drivers within radius_km using GEOSEARCH
    const nearby = await redis.call(
      "GEOSEARCH",
      REDIS_KEYS.ACTIVE_DRIVERS,
      "FROMLONLAT", lng, lat,
      "BYRADIUS", radius_km, "km",
      "ASC",
      "COUNT", 3,
      "WITHCOORD",
      "WITHDIST"
    );

    if (!nearby || nearby.length === 0) {
      return res.status(404).json({ error: "No drivers available nearby" });
    }

    // Filter out stale drivers (no heartbeat key means >30s stale)
    const freshDrivers = [];
    for (const entry of nearby) {
      const driverId = entry[0];
      const heartbeatKey = `${REDIS_KEYS.DRIVER_LAST_SEEN_PREFIX}${driverId}`;
      const lastSeen = await redis.get(heartbeatKey);
      if (lastSeen) {
        freshDrivers.push({
          driver_id: driverId,
          distance_km: parseFloat(entry[1]),
          lng: parseFloat(entry[2][0]),
          lat: parseFloat(entry[2][1]),
        });
      }
    }

    const ride_id = uuidv4();
    const event = {
      ride_id,
      rider_id,
      rider_lat: lat,
      rider_lng: lng,
      nearest_drivers: freshDrivers,
      timestamp: new Date().toISOString(),
    };

    await producer.send({
      topic: TOPICS.RIDE_REQUESTED,
      messages: [{ key: ride_id, value: JSON.stringify(event) }],
    });

    console.log(`[Matching] ride_id=${ride_id} rider=${rider_id} drivers=${freshDrivers.length}`);
    res.json({ ride_id, nearest_drivers: freshDrivers });
  } catch (err) {
    console.error("[Matching] request-ride error", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.MATCHING_PORT || 4004;

async function bootstrap() {
  await producer.connect();
  app.listen(PORT, () => console.log(`[matching-service] Listening on :${PORT}`));
}

bootstrap().catch((err) => {
  console.error("[Matching] Fatal error", err);
  process.exit(1);
});
