import { Registry, Gauge, Counter } from "prom-client";

export const register = new Registry();

export const breakerStateGauge = new Gauge({
  name: "trip_service_circuit_breaker_state",
  help: "Circuit breaker state: 0=closed, 0.5=halfOpen, 1=open",
  registers: [register],
});

export const tripsAcceptedCounter = new Counter({
  name: "trip_service_rides_accepted_total",
  help: "Total ride-accepted events processed",
  registers: [register],
});

export const tripsCompletedCounter = new Counter({
  name: "trip_service_rides_completed_total",
  help: "Total ride-completed events processed",
  registers: [register],
});

export const fallbackCounter = new Counter({
  name: "trip_service_fallback_total",
  help: "Total times fallback (Redis/Kafka recovery) was triggered",
  registers: [register],
});
