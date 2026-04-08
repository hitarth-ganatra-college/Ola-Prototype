import { useState, useEffect } from "react";
import { on, off } from "../ws/socketClient.js";

/**
 * Subscribe to realtime trip status updates for a specific ride.
 * Returns the latest trip status string or null.
 */
export function useTripStatus(rideId) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!rideId) return;

    function handler(update) {
      if (update.ride_id === rideId) {
        setStatus(update.status);
      }
    }

    on("trip_update", handler);
    return () => off("trip_update", handler);
  }, [rideId]);

  return status;
}
