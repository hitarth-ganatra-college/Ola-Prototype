import { kafka } from "../config/kafka.js";
import { TOPICS } from "../../../../shared/topics.js";
import { handleRideAccepted } from "../services/tripPersistenceService.js";

export async function startRideAcceptedConsumer() {
  const consumer = kafka.consumer({ groupId: "trip-service-accepted" });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.RIDE_ACCEPTED, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        await handleRideAccepted(payload);
      } catch (err) {
        console.error("[Consumer:ride-accepted] Error", err.message);
      }
    },
  });

  console.log(`[Consumer] Subscribed to ${TOPICS.RIDE_ACCEPTED}`);
}
