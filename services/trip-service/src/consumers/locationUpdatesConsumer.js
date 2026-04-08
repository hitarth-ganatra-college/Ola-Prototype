import { kafka } from "../config/kafka.js";
import { TOPICS } from "../../../../shared/topics.js";

export async function startLocationUpdatesConsumer() {
  const consumer = kafka.consumer({ groupId: "trip-service-location" });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.LOCATION_UPDATES, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        // Trip service only logs/forwards — actual geospatial write is in tracking-service
        console.debug(`[Consumer:location-updates] driver=${payload.driver_id} lat=${payload.lat} lng=${payload.lng}`);
      } catch (err) {
        console.error("[Consumer:location-updates] Error", err.message);
      }
    },
  });

  console.log(`[Consumer] Subscribed to ${TOPICS.LOCATION_UPDATES}`);
}
