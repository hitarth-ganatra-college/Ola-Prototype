import "dotenv/config";
import express from "express";
import { Kafka } from "kafkajs";
import Redis from "ioredis";
import { TOPICS, REDIS_KEYS } from "../../../shared/topics.js";

const app = express();
const kafka = new Kafka({
  clientId: "tracking-service",
  brokers: (process.env.KAFKA_BROKERS || "localhost:29092").split(","),
  retry: { retries: 10, initialRetryTime: 1000 },
});
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const DRIVER_TTL_SECONDS = 30;

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

const PORT = process.env.TRACKING_PORT || 4003;

async function bootstrap() {
  await startLocationConsumer();
  app.listen(PORT, () => console.log(`[tracking-service] Listening on :${PORT}`));
}

bootstrap().catch((err) => {
  console.error("[Tracking] Fatal error", err);
  process.exit(1);
});
