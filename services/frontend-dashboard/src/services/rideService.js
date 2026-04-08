import { API_BASE, apiFetch } from "./api.js";

/**
 * Request a ride from the matching service.
 * Returns { ride_id, nearest_drivers: [{ driver_id, distance_km, lat, lng }] }
 */
export async function requestRide({ rider_id, lat, lng, radius_km = 5 }) {
  return apiFetch(`${API_BASE.matching}/request-ride`, {
    method: "POST",
    body: JSON.stringify({ rider_id, lat, lng, radius_km }),
  });
}

/**
 * Accept a ride as a driver — emits ride-accepted event via trip service.
 * Returns { ok: true }
 */
export async function acceptRide({ ride_id, driver_id, rider_id }) {
  return apiFetch(`${API_BASE.trip}/accept-ride`, {
    method: "POST",
    body: JSON.stringify({ ride_id, driver_id, rider_id }),
  });
}

export async function completeRide({ ride_id, driver_id, fare, distance_km }) {
  return apiFetch(`${API_BASE.trip}/complete-ride`, {
    method: "POST",
    body: JSON.stringify({ ride_id, driver_id, fare, distance_km }),
  });
}

export async function getDriverRequests(driver_id) {
  return apiFetch(`${API_BASE.matching}/driver-requests/${encodeURIComponent(driver_id)}`);
}

export async function updateDriverRequestAction({ driver_id, ride_id, action }) {
  return apiFetch(`${API_BASE.matching}/driver-requests/${encodeURIComponent(driver_id)}/action`, {
    method: "POST",
    body: JSON.stringify({ ride_id, action }),
  });
}

/**
 * Get current trip status for a ride.
 * Returns { trip_id, status, ride_id, ... }
 */
export async function getTripStatus(ride_id) {
  return apiFetch(`${API_BASE.trip}/trip/${ride_id}`);
}
