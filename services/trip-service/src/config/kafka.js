import { Kafka } from "kafkajs";
import { TOPICS } from "../../../../shared/topics.js";

export { TOPICS };

const brokers = (process.env.KAFKA_BROKERS || "localhost:29092").split(",");

export const kafka = new Kafka({
  clientId: "trip-service",
  brokers,
  retry: { retries: 10, initialRetryTime: 1000 },
});

export const producer = kafka.producer();

export async function initKafka() {
  await producer.connect();
  console.log("[Kafka] Producer connected");
}
