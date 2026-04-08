/**
 * Base API configuration.
 * All endpoints are configurable through environment variables or defaults.
 * Backend URLs are proxied through Vite's dev server (see vite.config.js).
 */

export const API_BASE = {
  identity: import.meta.env.VITE_IDENTITY_URL || "/api/identity",
  matching: import.meta.env.VITE_MATCHING_URL || "/api/matching",
  trip: import.meta.env.VITE_TRIP_URL || "/api/trip",
  tracking: import.meta.env.VITE_TRACKING_URL || "/api/tracking",
  admin: import.meta.env.VITE_ADMIN_URL || "/api/tracking",
};

/**
 * Thin fetch wrapper that throws on non-OK responses.
 */
export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("velocity_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(body.error || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return res.json();
}
