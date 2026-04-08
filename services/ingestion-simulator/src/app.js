import "dotenv/config";
import { Kafka } from "kafkajs";
import Redis from "ioredis";
import { TOPICS, REDIS_KEYS } from "../../../shared/topics.js";

const kafka = new Kafka({
  clientId: "ingestion-simulator",
  brokers: (process.env.KAFKA_BROKERS || "localhost:29092").split(","),
  retry: { retries: 10, initialRetryTime: 1000 },
});
const producer = kafka.producer();

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// 50 simulated drivers centered at Mumbai (19.0760, 72.8777)
const CENTER_LAT = 19.0760;
const CENTER_LNG = 72.8777;
const RADIUS_DEG = 0.045; // ~5km

const NUM_DRIVERS = 50;

const drivers = Array.from({ length: NUM_DRIVERS }, (_, i) => ({
  id: `sim-driver-${String(i + 1).padStart(3, "0")}`,
  lat: CENTER_LAT + (Math.random() - 0.5) * RADIUS_DEG * 2,
  lng: CENTER_LNG + (Math.random() - 0.5) * RADIUS_DEG * 2,
}));

function jitter(val, delta = 0.0005) {
  return val + (Math.random() - 0.5) * delta * 2;
}

async function tick() {
  for (const driver of drivers) {
    const manualKey = `${REDIS_KEYS.DRIVER_MANUAL_PREFIX}${driver.id}`;
    const isManual = await redis.get(manualKey);
    if (isManual) {
      // Manual override active — skip simulated movement for this driver
      continue;
    }

    driver.lat = jitter(driver.lat);
    driver.lng = jitter(driver.lng);

    const msg = {
      driver_id: driver.id,
      lat: driver.lat,
      lng: driver.lng,
      timestamp: new Date().toISOString(),
    };

    await producer.send({
      topic: TOPICS.LOCATION_UPDATES,
      messages: [{ key: driver.id, value: JSON.stringify(msg) }],
    });
  }
}

async function bootstrap() {
  await producer.connect();
  redis.on("connect", () => console.log("[Redis] Connected"));

  console.log(`[Ingestion] Simulating ${NUM_DRIVERS} drivers...`);
  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      console.error("[Ingestion] tick error", err.message);
    }
  }, 2000);
}

bootstrap().catch((err) => {
  console.error("[Ingestion] Fatal error", err);
  process.exit(1);
});
