import { redis } from "../config/redis.js";
import { producer, TOPICS } from "../config/kafka.js";
import { REDIS_KEYS } from "../../../../shared/topics.js";
import { fallbackCounter } from "../metrics/prometheus.js";

export async function persistFallback(eventType, payload) {
  const envelope = {
    eventType,
    payload,
    reason: "MONGO_UNAVAILABLE",
    ts: new Date().toISOString(),
  };

  const envelopeStr = JSON.stringify(envelope);

  await redis.lpush(REDIS_KEYS.PENDING_WRITES, envelopeStr);
  await producer.send({
    topic: TOPICS.PERSISTENCE_RECOVERY,
    messages: [
      {
        key: payload.trip_id || payload.ride_id || "unknown",
        value: envelopeStr,
      },
    ],
  });

  fallbackCounter.inc();
  console.warn(`[Fallback] SYNCING — queued ${eventType} for ${payload.trip_id || payload.ride_id}`);
  return { status: "SYNCING", queued: true };
}
