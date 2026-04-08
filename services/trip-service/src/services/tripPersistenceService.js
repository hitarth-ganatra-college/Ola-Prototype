import { Trip } from "../models/Trip.js";
import { mongoBreaker } from "../breakers/mongoBreaker.js";
import { persistFallback } from "./fallbackService.js";
import { tripsAcceptedCounter, tripsCompletedCounter } from "../metrics/prometheus.js";

async function upsertTrip(payload) {
  return Trip.findOneAndUpdate(
    { trip_id: payload.trip_id },
    payload,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function handleRideAccepted(payload) {
  const tripData = {
    trip_id: payload.trip_id || `trip-${payload.ride_id}`,
    ride_id: payload.ride_id,
    driver_id: payload.driver_id,
    rider_id: payload.rider_id,
    status: "ACCEPTED",
    accepted_at: new Date(payload.timestamp || Date.now()),
  };

  try {
    const trip = await mongoBreaker.fire(upsertTrip, tripData);
    tripsAcceptedCounter.inc();
    console.log(`[TripService] Persisted ACCEPTED trip: ${tripData.trip_id}`);
    return trip;
  } catch (err) {
    return persistFallback("ride-accepted", tripData);
  }
}

export async function handleRideCompleted(payload) {
  const tripData = {
    trip_id: payload.trip_id || `trip-${payload.ride_id}`,
    ride_id: payload.ride_id,
    driver_id: payload.driver_id,
    status: "COMPLETED",
    completed_at: new Date(payload.timestamp || Date.now()),
    fare: payload.fare,
    distance_km: payload.distance_km,
  };

  try {
    const trip = await mongoBreaker.fire(upsertTrip, tripData);
    tripsCompletedCounter.inc();
    console.log(`[TripService] Persisted COMPLETED trip: ${tripData.trip_id}`);
    return trip;
  } catch (err) {
    return persistFallback("ride-completed", tripData);
  }
}
