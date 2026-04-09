# 🚗 Ola-Prototype — Project Velocity

A microservices-based prototype of a ride-hailing tracker (Ola/Uber clone), demonstrating:
- **Event-driven architecture** with Apache Kafka
- **Real-time geospatial tracking** with Redis
- **Trip persistence** with MongoDB
- **Circuit Breaker resilience** (Opossum) with Redis/Kafka fallback
- **Observability** with Prometheus + Grafana

---

## Architecture Overview

```
Ingestion Simulator ──► Kafka (location-updates) ──► Tracking Service ──► Redis (active_drivers)
                                                                                │
Rider App ──► Matching Service ──► Redis GEOSEARCH ──► Kafka (ride-requested)  │
                                                             │                  │
                                                      Driver accepts            │
                                                             │                  │
                                                   Kafka (ride-accepted) ──► Trip Service ──► MongoDB
                                                             │                         └──► Fallback: Redis pending_writes
                                                                                              + Kafka (persistence-recovery)
```

## Service Responsibilities

| Service | Port | Responsibility |
|---|---|---|
| `identity-service` | 4001 | JWT auth, seeded users (4 drivers + 1 rider) |
| `ingestion-simulator` | — | Emits 50+ driver positions to `location-updates` every 2s |
| `tracking-service` | 4003 | Consumes `location-updates`, writes `GEOADD active_drivers` with 30s TTL |
| `matching-service` | 4004 | `POST /request-ride` → GEOSEARCH nearest 3 → emit `ride-requested` |
| `trip-service` | 4005 | Consumes `ride-accepted`/`ride-completed`, persists to MongoDB via circuit breaker |
| `frontend-dashboard` | 5173 | **React + Tailwind + MapTiler/Leaflet UI** — Rider, Driver, Admin views with realtime updates |

---

## Local Run Instructions

### Prerequisites
- Docker + Docker Compose
- Node.js 20+

### 1. Start infrastructure

```bash
cp .env.example .env
docker compose up -d
```

This starts: Zookeeper, Kafka, Redis, MongoDB, Prometheus (`:9090`), Grafana (`:3000`).

### 2. Create Kafka topics (optional — auto-created by default)

```bash
chmod +x scripts/create-topics.sh
./scripts/create-topics.sh
```

### 3. Install & start services

Each service is independent. Open separate terminals:

```bash
# Trip Service (priority / resilience core)
cd services/trip-service && npm install && npm start

# Identity Service
cd services/identity-service && npm install && npm start

# Tracking Service
cd services/tracking-service && npm install && npm start

# Matching Service
cd services/matching-service && npm install && npm start

# Ingestion Simulator
cd services/ingestion-simulator && npm install && npm start

# Frontend Dashboard
cd services/frontend-dashboard && npm install && npm run dev
```

---

## Frontend Setup

### Tech Stack
- **React 18** + **Vite 5** (hot reload, instant startup)
- **Tailwind CSS** — utility-first dark-theme UI
- **React Router v6** — client-side routing per role
- **react-leaflet + leaflet** — Leaflet map with MapTiler tiles and draggable markers
- **react-hot-toast** — toast/snackbar feedback
- **WebSocket/SSE adapter** — realtime location & trip updates (with mock fallback)

### Required Environment Variables

Copy the frontend env example and add your MapTiler key:

```bash
cp services/frontend-dashboard/.env.example services/frontend-dashboard/.env
# Then edit .env and replace YOUR_KEY_HERE with your actual key
```

| Variable | Required | Description |
|---|---|---|
| `VITE_MAPTILER_API_KEY` | ✅ For map | Get from [MapTiler Cloud](https://cloud.maptiler.com/account/keys/). Free tier available. |
| `VITE_WS_URL` | Optional | WebSocket URL for realtime updates (e.g. `ws://localhost:4006`). Defaults to mock adapter. |
| `VITE_SSE_URL` | Optional | SSE URL for realtime updates. Fallback before mock adapter. |

> If `VITE_MAPTILER_API_KEY` is missing or set to `YOUR_KEY_HERE`, the Admin map shows a clear placeholder with instructions — the rest of the app works normally.

### Run Frontend

```bash
cd services/frontend-dashboard
npm install
npm run dev
# Open http://localhost:5173
```

### Role Flows

#### 🚕 Rider Flow
1. Open `http://localhost:5173` → redirected to Login
2. Click **"Rider"** demo button (or login with `rider1` / `pass123`)
3. Click **"Request Ride"** — calls `POST /api/matching/request-ride`
4. View nearest 3 drivers with distances
5. Trip status updates via WebSocket (`Searching → Assigned → Syncing... → Completed`)
6. `Syncing...` status appears when MongoDB is down and Redis fallback is active

#### 🚗 Driver Flow
1. Login with `driver1` / `pass123` (or any of `driver1`–`driver4`)
2. In Driver view, use **"Acting as driver"** select to switch between driver identities (including simulation drivers)
3. See incoming requests targeted to the selected driver (`GET /driver-requests/:driver_id`)
4. Click **"Accept Ride"** — updates request status + calls `POST /api/trip/accept-ride` to emit `ride-accepted`
5. Click **"Reject Ride"** to remove the request from that driver queue
6. Active trip card shows trip details + status badge; click **"Mark Trip Completed"** to emit `ride-completed`

#### 🗺️ Admin/Debug Flow
1. Login with any account → click **Admin View** in sidebar
2. MapTiler map shows all live driver markers (green = simulated, red = manual override)
3. Use **"Enable Override"** toggle per driver to mark that driver manual in Redis (`driver:manual:<id>=1`)
4. Enter latitude/longitude inputs for the enabled driver and click **Save Coordinates** (drag works too)
5. Backend sets `driver:manual:<id>=1` in Redis, pausing simulation for that driver
6. Use **"Disable Override"** to resume simulation

### Integration Assumptions

| Frontend call | Backend endpoint | Behaviour if backend offline |
|---|---|---|
| Login | `POST /api/identity/login` | Demo mode: stores mock user locally |
| Request ride | `POST /api/matching/request-ride` | Error shown in UI with retry option |
| Driver requests | `GET /api/matching/driver-requests/:driver_id` | Returns queued requests for the selected driver |
| Driver action | `POST /api/matching/driver-requests/:driver_id/action` | Accept/reject request and update per-driver queue |
| Accept ride | `POST /api/trip/accept-ride` | Emits `ride-accepted` event |
| Complete ride | `POST /api/trip/complete-ride` | Emits `ride-completed` event |
| Manual location | `POST /api/tracking/manual-location` | Saves manual coordinates in Redis GEO set |
| Manual override toggle | `POST /api/tracking/manual-override` | Persists manual override state in Redis |
| Realtime updates | `VITE_WS_URL` or `VITE_SSE_URL` | Falls back to mock adapter (simulated driver movement) |

---

## Sample cURL Requests

### Login (Identity Service)

```bash
curl -X POST http://localhost:4001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rider1","password":"pass123"}'
```

### Request a Ride (Matching Service)

```bash
curl -X POST http://localhost:4004/request-ride \
  -H "Content-Type: application/json" \
  -d '{"rider_id":"rider-001","lat":19.076,"lng":72.8777}'
```

### Simulate Ride Accepted (Trip Service via Kafka)

Produce a message to `ride-accepted` topic:
```bash
docker exec -it <kafka-container> kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic ride-accepted \
  --property "key.separator=:" \
  --property "parse.key=true"
# paste:
ride-001:{"ride_id":"ride-001","trip_id":"trip-001","driver_id":"driver-001","rider_id":"rider-001","timestamp":"2024-01-01T10:00:00Z"}
```

### Check Trip Service Health

```bash
curl http://localhost:4005/health
```

### Check Prometheus Metrics

```bash
curl http://localhost:4005/metrics
```

---

## Circuit Breaker Demo

The trip service wraps all MongoDB writes in an **Opossum circuit breaker**.

To demo the fallback:

1. Stop MongoDB: `docker compose stop mongo`
2. Produce a `ride-accepted` event (see above)
3. Watch logs: `[Fallback] SYNCING — queued ride-accepted for ...`
4. Check Redis: `redis-cli LRANGE pending_writes 0 -1`
5. Check Kafka topic `persistence-recovery` for queued events
6. Restart MongoDB: `docker compose start mongo` — breaker will half-open and retry

Breaker states are visible in Grafana → **Project Velocity Overview** dashboard.

---

## Manual Driver Override

To stop simulation for a driver and enable manual coordinate updates:

```bash
# Enable manual override for driver-001
redis-cli SET driver:manual:driver-001 1

# Or use the helper script for all 4 manual drivers:
./scripts/seed-manual-drivers.sh set

# Clear overrides:
./scripts/seed-manual-drivers.sh clear
```

In the Admin Map view of the frontend, draggable markers send coordinates directly to Redis.

---

## Observability

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
  - Dashboard: *Project Velocity Overview* (auto-provisioned)
  - Metrics: circuit breaker state, rides accepted/completed, fallback count

---

## Kafka Topics

| Topic | Producer | Consumer |
|---|---|---|
| `location-updates` | ingestion-simulator | tracking-service, trip-service |
| `ride-requested` | matching-service | (driver notification) |
| `ride-accepted` | driver client | trip-service |
| `ride-completed` | driver client | trip-service |
| `persistence-recovery` | trip-service (fallback) | recovery worker |

## Redis Keys

| Key | Type | Description |
|---|---|---|
| `active_drivers` | GeoSet | Geospatial index of all live driver positions |
| `pending_writes` | List | Fallback queue for failed MongoDB writes |
| `driver:manual:<id>` | String | Manual override flag — disables simulation for driver |
| `driver:lastSeen:<id>` | String | Freshness heartbeat, expires in 30s |
