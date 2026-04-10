# 🚗 Ola-Prototype (Project Velocity)

Updated guide for the current microservices flow and observability setup.

## What this project demonstrates
- Kafka event flow between services
- Live driver tracking with Redis GEO
- Trip persistence in MongoDB
- Opossum circuit breaker + Redis/Kafka fallback in `trip-service`
- Prometheus + Grafana monitoring

## Services and ports
| Service | Port |
|---|---|
| identity-service | 4001 |
| tracking-service | 4003 |
| matching-service | 4004 |
| trip-service | 4005 |
| frontend-dashboard (Vite) | 5173 |
| Prometheus | 9090 |
| Grafana | 3000 |

---

## 1) Run the whole project

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Python 3.9+

### A. Start infra (Kafka, Redis, Mongo, Prometheus, Grafana)
```bash
cp .env.example .env
docker compose up -d
```

### B. Start the full project (single command)
Run from repository root:
```bash
python scripts/controller.py
```

> If you prefer, you can still run each service in its own terminal with `npm start` / `npm run dev`.
> Press `Ctrl+C` to stop all services started by the controller.

---

## 2) Dashboard links

### App dashboard (frontend)
- Login: http://localhost:5173/login
- Rider: http://localhost:5173/rider
- Driver: http://localhost:5173/driver
- Admin map: http://localhost:5173/admin

### Observability dashboards
- Prometheus UI: http://localhost:9090
- Grafana UI: http://localhost:3000 (admin/admin)
- Grafana dashboard (auto-provisioned):  
  http://localhost:3000/d/velocity-overview-001/project-velocity-overview

---

## 3) Commands/queries to use in Prometheus and Grafana

### Prometheus query expressions (paste in **Graph** tab)
```promql
trip_service_circuit_breaker_state
trip_service_rides_accepted_total
trip_service_rides_completed_total
trip_service_fallback_total
rate(trip_service_fallback_total[5m])
```

### Quick metrics check from terminal
```bash
curl http://localhost:4005/metrics
```

### Grafana query usage
1. Open Grafana → **Explore** (or add panel in dashboard)
2. Select **Prometheus** datasource
3. Paste the same PromQL queries above
4. Run query to visualize breaker state, accepted/completed rides, and fallback activity

---

## 4) Trigger circuit breaker (last step)

Use these exact steps to force fallback behavior:

```bash
# 1) Stop MongoDB so writes fail
docker compose stop mongo

# 2) Trigger a ride accept event via trip-service API
curl -X POST http://localhost:4005/accept-ride \
  -H "Content-Type: application/json" \
  -d '{"ride_id":"ride-cb-001","driver_id":"driver-001","rider_id":"rider-001"}'

# 3) Verify fallback queue in Redis
redis-cli LRANGE pending_writes 0 -1

# 4) Restart MongoDB
docker compose start mongo
```

If `redis-cli` is not available on your host, use:
```bash
docker compose exec redis redis-cli LRANGE pending_writes 0 -1
```

Now verify in dashboards:
- Prometheus query: `trip_service_circuit_breaker_state`
- Prometheus query: `trip_service_fallback_total`
- Grafana dashboard: `Project Velocity Overview`

---

## Helpful API checks
```bash
curl http://localhost:4001/health
curl http://localhost:4003/health
curl http://localhost:4004/health
curl http://localhost:4005/health
```
