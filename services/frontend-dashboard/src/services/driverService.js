import { API_BASE, apiFetch } from "./api.js";

/**
 * Fetch all active drivers from the tracking service.
 * Returns [{ driver_id, lat, lng, isManual }]
 */
export async function getActiveDrivers() {
  return apiFetch(`${API_BASE.tracking}/drivers`);
}

/**
 * Push a manual location override for a driver.
 * Sends coordinates to the ingestion/admin endpoint which updates Redis
 * and stops simulation for that driver.
 */
export async function pushManualLocation({ driver_id, lat, lng }) {
  return apiFetch(`${API_BASE.admin}/manual-location`, {
    method: "POST",
    body: JSON.stringify({ driver_id, lat, lng }),
  });
}

/**
 * Toggle the manual override flag for a driver.
 * enabled=true  → sets driver:manual:<id>=1 in Redis
 * enabled=false → removes the flag, resuming simulation
 */
export async function toggleManualOverride({ driver_id, enabled }) {
  return apiFetch(`${API_BASE.admin}/manual-override`, {
    method: "POST",
    body: JSON.stringify({ driver_id, enabled }),
  });
}

export async function getManualOverrides() {
  return apiFetch(`${API_BASE.admin}/manual-overrides`);
}
