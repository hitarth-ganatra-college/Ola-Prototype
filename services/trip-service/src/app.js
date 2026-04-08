import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { connectMongo } from "./config/mongo.js";
import { redis } from "./config/redis.js";
import { initKafka, producer, TOPICS } from "./config/kafka.js";
import { startRideAcceptedConsumer } from "./consumers/rideAcceptedConsumer.js";
import { startRideCompletedConsumer } from "./consumers/rideCompletedConsumer.js";
import { startLocationUpdatesConsumer } from "./consumers/locationUpdatesConsumer.js";
import { register, breakerStateGauge } from "./metrics/prometheus.js";
import { mongoBreaker } from "./breakers/mongoBreaker.js";
import { Trip } from "./models/Trip.js";

const app = express();
app.use(express.json());
const tripWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
const tripReadLimiter = rateLimit({
  windowMs: 60_000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "trip-service" }));

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.post("/accept-ride", tripWriteLimiter, async (req, res) => {
  const { ride_id, driver_id, rider_id } = req.body;
  if (!ride_id || !driver_id) {
    return res.status(400).json({ error: "ride_id and driver_id are required" });
  }

  try {
    const payload = {
      ride_id,
      trip_id: `trip-${ride_id}`,
      driver_id,
      rider_id,
      timestamp: new Date().toISOString(),
    };
    await producer.send({
      topic: TOPICS.RIDE_ACCEPTED,
      messages: [{ key: ride_id, value: JSON.stringify(payload) }],
    });
    res.json({ ok: true, event: "ride-accepted", ride_id, trip_id: payload.trip_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/complete-ride", tripWriteLimiter, async (req, res) => {
  const { ride_id, driver_id, fare, distance_km } = req.body;
  if (!ride_id || !driver_id) {
    return res.status(400).json({ error: "ride_id and driver_id are required" });
  }

  try {
    const payload = {
      ride_id,
      trip_id: `trip-${ride_id}`,
      driver_id,
      fare,
      distance_km,
      timestamp: new Date().toISOString(),
    };
    await producer.send({
      topic: TOPICS.RIDE_COMPLETED,
      messages: [{ key: ride_id, value: JSON.stringify(payload) }],
    });
    res.json({ ok: true, event: "ride-completed", ride_id, trip_id: payload.trip_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/trip/:ride_id", tripReadLimiter, async (req, res) => {
  try {
    const trip = await Trip.findOne({ ride_id: req.params.ride_id }).lean();
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

mongoBreaker.on("open",     () => breakerStateGauge.set(1));
mongoBreaker.on("halfOpen", () => breakerStateGauge.set(0.5));
mongoBreaker.on("close",    () => breakerStateGauge.set(0));

const PORT = process.env.TRIP_PORT || process.env.PORT || 4005;

async function bootstrap() {
  await connectMongo();
  await redis.ping();
  await initKafka();

  await startRideAcceptedConsumer();
  await startRideCompletedConsumer();
  await startLocationUpdatesConsumer();

  app.listen(PORT, () => console.log(`[trip-service] Listening on :${PORT}`));
}

bootstrap().catch((err) => {
  console.error("[trip-service] Fatal bootstrap error", err);
  process.exit(1);
});
