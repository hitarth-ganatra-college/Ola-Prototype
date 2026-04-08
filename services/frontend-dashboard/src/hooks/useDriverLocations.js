import { useState, useEffect, useRef } from "react";
import { on, off } from "../ws/socketClient.js";

/**
 * Subscribe to realtime driver location updates.
 * Returns a map of driver_id -> { driver_id, lat, lng, timestamp }
 * @param {string[]} [driverIds] - Optional filter; omit to receive all drivers.
 */
export function useDriverLocations(driverIds) {
  const [locations, setLocations] = useState({});
  const filterRef = useRef(driverIds);
  filterRef.current = driverIds;

  useEffect(() => {
    function handler(update) {
      const filter = filterRef.current;
      if (filter && filter.length > 0 && !filter.includes(update.driver_id)) return;
      setLocations((prev) => ({ ...prev, [update.driver_id]: update }));
    }

    on("location_update", handler);
    return () => off("location_update", handler);
  }, []);

  return locations;
}
