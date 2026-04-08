import { API_BASE, apiFetch } from "./api.js";

/**
 * Authenticate a user with the identity service.
 * Returns { token, user: { id, username, role } }
 */
export async function login(username, password) {
  const data = await apiFetch(`${API_BASE.identity}/login`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (data.token) {
    localStorage.setItem("velocity_token", data.token);
    localStorage.setItem("velocity_user", JSON.stringify(data.user));
  }
  return data;
}

export function logout() {
  localStorage.removeItem("velocity_token");
  localStorage.removeItem("velocity_user");
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem("velocity_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredToken() {
  return localStorage.getItem("velocity_token");
}
