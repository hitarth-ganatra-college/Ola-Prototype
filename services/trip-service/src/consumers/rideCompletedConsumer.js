import { kafka } from "../config/kafka.js";
import { TOPICS } from "../../../../shared/topics.js";
import { handleRideCompleted } from "../services/tripPersistenceService.js";

export async function startRideCompletedConsumer() {
  const consumer = kafka.consumer({ groupId: "trip-service-completed" });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.RIDE_COMPLETED, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        await handleRideCompleted(payload);
      } catch (err) {
        console.error("[Consumer:ride-completed] Error", err.message);
      }
    },
  });

  console.log(`[Consumer] Subscribed to ${TOPICS.RIDE_COMPLETED}`);
}
