import "dotenv/config";
import express from "express";
import { connectMongo } from "./config/mongo.js";
import { redis } from "./config/redis.js";
import { initKafka } from "./config/kafka.js";
import { startRideAcceptedConsumer } from "./consumers/rideAcceptedConsumer.js";
import { startRideCompletedConsumer } from "./consumers/rideCompletedConsumer.js";
import { startLocationUpdatesConsumer } from "./consumers/locationUpdatesConsumer.js";
import { register, breakerStateGauge } from "./metrics/prometheus.js";
import { mongoBreaker } from "./breakers/mongoBreaker.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "trip-service" }));

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
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
