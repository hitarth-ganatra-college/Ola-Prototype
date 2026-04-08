/**
 * Realtime client adapter for live location and trip updates.
 *
 * Strategy:
 *   1. Attempt WebSocket connection to VITE_WS_URL (e.g. ws://localhost:4006).
 *   2. Fall back to SSE at VITE_SSE_URL if WebSocket fails.
 *   3. If neither is available, use a mock polling adapter that emits
 *      simulated driver movement events (for local development without backend).
 *
 * TODO: Replace mock adapter with a real backend gateway when available.
 *       Backend should expose a WebSocket or SSE endpoint that streams:
 *       - { type: "LOCATION_UPDATE", driver_id, lat, lng, timestamp }
 *       - { type: "TRIP_UPDATE",    ride_id, status, timestamp }
 */

const WS_URL = import.meta.env.VITE_WS_URL || null;
const SSE_URL = import.meta.env.VITE_SSE_URL || null;

// ─── Listener registry ───────────────────────────────────────────────────────
const listeners = { location_update: [], trip_update: [], connect: [], disconnect: [] };

export function on(event, cb) {
  if (listeners[event]) listeners[event].push(cb);
  return () => off(event, cb);
}

export function off(event, cb) {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter((l) => l !== cb);
  }
}

function emit(event, data) {
  (listeners[event] || []).forEach((cb) => cb(data));
}

// ─── WebSocket adapter ────────────────────────────────────────────────────────
let ws = null;

function connectWebSocket(url) {
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("[WS] Connected to", url);
    emit("connect", { transport: "websocket" });
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "LOCATION_UPDATE") emit("location_update", msg);
      if (msg.type === "TRIP_UPDATE") emit("trip_update", msg);
    } catch {
      // ignore malformed messages
    }
  };

  ws.onerror = () => {
    console.warn("[WS] Error — falling back to SSE or mock");
    ws.close();
  };

  ws.onclose = () => {
    emit("disconnect", { transport: "websocket" });
    ws = null;
  };
}

// ─── SSE adapter ─────────────────────────────────────────────────────────────
let sse = null;

function connectSSE(url) {
  sse = new EventSource(url);

  sse.onopen = () => {
    console.log("[SSE] Connected to", url);
    emit("connect", { transport: "sse" });
  };

  sse.addEventListener("LOCATION_UPDATE", (e) => {
    try { emit("location_update", JSON.parse(e.data)); } catch { /* ignore */ }
  });

  sse.addEventListener("TRIP_UPDATE", (e) => {
    try { emit("trip_update", JSON.parse(e.data)); } catch { /* ignore */ }
  });

  sse.onerror = () => {
    console.warn("[SSE] Error — falling back to mock adapter");
    sse.close();
    sse = null;
    startMockAdapter();
  };
}

// ─── Mock adapter (for dev without backend) ──────────────────────────────────
// TODO: Remove this when a real realtime gateway is available.
let mockInterval = null;

const CENTER_LAT = 19.076;
const CENTER_LNG = 72.8777;

function randomOffset(range = 0.05) {
  return (Math.random() - 0.5) * 2 * range;
}

let mockDrivers = Array.from({ length: 12 }, (_, i) => ({
  driver_id: `driver-sim-${String(i + 1).padStart(3, "0")}`,
  lat: CENTER_LAT + randomOffset(),
  lng: CENTER_LNG + randomOffset(),
}));

function startMockAdapter() {
  if (mockInterval) return;
  console.warn(
    "[Mock WS] No realtime backend found. Using mock location adapter.\n" +
      "TODO: Connect VITE_WS_URL or VITE_SSE_URL to a real backend gateway."
  );
  emit("connect", { transport: "mock" });

  mockInterval = setInterval(() => {
    mockDrivers = mockDrivers.map((d) => ({
      ...d,
      lat: d.lat + randomOffset(0.001),
      lng: d.lng + randomOffset(0.001),
    }));

    mockDrivers.forEach((d) => {
      emit("location_update", {
        type: "LOCATION_UPDATE",
        driver_id: d.driver_id,
        lat: d.lat,
        lng: d.lng,
        timestamp: new Date().toISOString(),
      });
    });
  }, 2000);
}

function stopMockAdapter() {
  if (mockInterval) {
    clearInterval(mockInterval);
    mockInterval = null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function connect() {
  if (WS_URL) {
    connectWebSocket(WS_URL);
  } else if (SSE_URL) {
    connectSSE(SSE_URL);
  } else {
    startMockAdapter();
  }
}

export function disconnect() {
  if (ws) { ws.close(); ws = null; }
  if (sse) { sse.close(); sse = null; }
  stopMockAdapter();
  emit("disconnect", { transport: "all" });
}

export function isConnected() {
  return (
    (ws && ws.readyState === WebSocket.OPEN) ||
    (sse && sse.readyState === EventSource.OPEN) ||
    mockInterval !== null
  );
}
