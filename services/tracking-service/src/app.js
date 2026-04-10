import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { Kafka } from "kafkajs";
import Redis from "ioredis";
import { TOPICS, REDIS_KEYS } from "../../../shared/topics.js";

const app = express();
app.use(express.json());
const kafka = new Kafka({
  clientId: "tracking-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:29092").split(","),
  retry: { retries: 10, initialRetryTime: 1000 },
});
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const DRIVER_TTL_SECONDS = 30;
const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

async function startLocationConsumer() {
  const consumer = kafka.consumer({ groupId: "tracking-service-location" });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.LOCATION_UPDATES, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const { driver_id, lat, lng } = JSON.parse(message.value.toString());

        // Update geospatial index
        await redis.geoadd(REDIS_KEYS.ACTIVE_DRIVERS, lng, lat, driver_id);

        // Freshness heartbeat key — expires in 30s
        const heartbeatKey = `${REDIS_KEYS.DRIVER_LAST_SEEN_PREFIX}${driver_id}`;
        await redis.set(heartbeatKey, Date.now(), "EX", DRIVER_TTL_SECONDS);
      } catch (err) {
        console.error("[Tracking] eachMessage error", err.message);
      }
    },
  });

  console.log(`[Tracking] Subscribed to ${TOPICS.LOCATION_UPDATES}`);
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "tracking-service" }));
app.get("/metrics", (_req, res) => {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send([
    "# HELP tracking_service_up Tracking service availability",
    "# TYPE tracking_service_up gauge",
    "tracking_service_up 1",
    "# HELP tracking_service_uptime_seconds Tracking service uptime in seconds",
    "# TYPE tracking_service_uptime_seconds gauge",
    `tracking_service_uptime_seconds ${process.uptime().toFixed(2)}`,
    "",
  ].join("\n"));
});

app.get("/drivers", readLimiter, async (_req, res) => {
  try {
    const driverIds = await redis.zrange(REDIS_KEYS.ACTIVE_DRIVERS, 0, -1);
    if (!driverIds.length) return res.json([]);

    const coords = await redis.geopos(REDIS_KEYS.ACTIVE_DRIVERS, ...driverIds);
    const manualKeys = driverIds.map((id) => `${REDIS_KEYS.DRIVER_MANUAL_PREFIX}${id}`);
    const manualValues = await redis.mget(...manualKeys);

    const drivers = driverIds
      .map((id, idx) => {
        const coord = coords[idx];
        if (!coord) return null;
        return {
          driver_id: id,
          lng: parseFloat(coord[0]),
          lat: parseFloat(coord[1]),
          isManual: manualValues[idx] === "1",
        };
      })
      .filter(Boolean);

    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/manual-overrides", readLimiter, async (_req, res) => {
  try {
    const keys = [];
    let cursor = "0";
    const pattern = `${REDIS_KEYS.DRIVER_MANUAL_PREFIX}*`;
    do {
      const [nextCursor, found] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      keys.push(...found);
    } while (cursor !== "0");
    const driver_ids = keys.map((key) => key.replace(REDIS_KEYS.DRIVER_MANUAL_PREFIX, ""));
    res.json({ driver_ids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/manual-override", writeLimiter, async (req, res) => {
  const { driver_id, enabled } = req.body;
  if (!driver_id || typeof enabled !== "boolean") {
    return res.status(400).json({ error: "driver_id and enabled(boolean) are required" });
  }

  try {
    const manualKey = `${REDIS_KEYS.DRIVER_MANUAL_PREFIX}${driver_id}`;
    if (enabled) {
      await redis.set(manualKey, "1");
    } else {
      await redis.del(manualKey);
    }
    res.json({ ok: true, driver_id, enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/manual-location", writeLimiter, async (req, res) => {
  const { driver_id, lat, lng } = req.body;
  if (!driver_id || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "driver_id, lat(number), lng(number) are required" });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "lat/lng out of valid range" });
  }

  try {
    const manualKey = `${REDIS_KEYS.DRIVER_MANUAL_PREFIX}${driver_id}`;
    const isManual = await redis.get(manualKey);
    if (isManual !== "1") {
      return res.status(409).json({ error: "Manual override must be enabled first for this driver" });
    }

    await redis.geoadd(REDIS_KEYS.ACTIVE_DRIVERS, lng, lat, driver_id);
    await redis.set(`${REDIS_KEYS.DRIVER_LAST_SEEN_PREFIX}${driver_id}`, Date.now(), "EX", DRIVER_TTL_SECONDS);
    res.json({ ok: true, driver_id, lat, lng, isManual: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.TRACKING_PORT || 4003;

async function bootstrap() {
  await startLocationConsumer();
  app.listen(PORT, () => console.log(`[tracking-service] Listening on :${PORT}`));
}

bootstrap().catch((err) => {
  console.error("[Tracking] Fatal error", err);
  process.exit(1);
});
