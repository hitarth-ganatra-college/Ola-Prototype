import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth.jsx";
import { acceptRide } from "../services/rideService.js";
import { useTripStatus } from "../hooks/useTripStatus.js";
import StatusBadge from "../components/StatusBadge.jsx";

// TODO: Replace with real Kafka/SSE ride-request feed from backend.
// For now, ride requests arrive via mock data or the trip_update realtime event.
const MOCK_REQUESTS = [
  { ride_id: "ride-demo-001", rider_id: "rider-001", rider_lat: 19.076,  rider_lng: 72.8777, distance_km: 1.2 },
  { ride_id: "ride-demo-002", rider_id: "rider-001", rider_lat: 19.0820, rider_lng: 72.8900, distance_km: 2.7 },
];

export default function DriverView() {
  const { user } = useAuth();
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [activeRide, setActiveRide] = useState(null);
  const [accepting, setAccepting] = useState(null); // ride_id being accepted

  const realtimeStatus = useTripStatus(activeRide?.ride_id);
  const displayStatus = realtimeStatus || activeRide?.status;

  async function handleAccept(rideReq) {
    setAccepting(rideReq.ride_id);
    const toastId = toast.loading(`Accepting ride ${rideReq.ride_id}…`);
    try {
      const driverId = user?.id || "driver-001";
      await acceptRide({ ride_id: rideReq.ride_id, driver_id: driverId });
      setActiveRide({ ...rideReq, status: "ACCEPTED" });
      setRequests((prev) => prev.filter((r) => r.ride_id !== rideReq.ride_id));
      toast.success("Ride accepted!", { id: toastId });
    } catch (err) {
      // Backend may not be running — simulate acceptance for demo
      setActiveRide({ ...rideReq, status: "ACCEPTED" });
      setRequests((prev) => prev.filter((r) => r.ride_id !== rideReq.ride_id));
      toast(`Demo: ride ${rideReq.ride_id} accepted (offline)`, { id: toastId, icon: "🔧" });
    } finally {
      setAccepting(null);
    }
  }

  function handleCompleteRide() {
    toast.success("Trip completed!");
    setActiveRide(null);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Driver Dashboard</h2>
        <p className="text-gray-400 text-sm mt-1">
          Welcome{user ? `, ${user.username}` : ""}. Manage your incoming ride requests.
        </p>
      </div>

      {/* Active trip card */}
      {activeRide && (
        <div className="card border border-emerald-800/50 bg-emerald-950/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Active Trip</h3>
            <StatusBadge status={displayStatus || "ACCEPTED"} />
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Ride ID</span>
              <code className="text-gray-300">{activeRide.ride_id}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Rider</span>
              <span className="text-gray-300">{activeRide.rider_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pickup</span>
              <span className="text-gray-300">
                {activeRide.rider_lat?.toFixed(4)}°N, {activeRide.rider_lng?.toFixed(4)}°E
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Distance</span>
              <span className="text-gray-300">{activeRide.distance_km?.toFixed(2)} km</span>
            </div>
          </div>

          {displayStatus === "Syncing..." && (
            <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-800/50 rounded-lg">
              <p className="text-yellow-400 text-xs">
                Trip is syncing — MongoDB fallback active. Data queued to Redis.
              </p>
            </div>
          )}

          <button
            onClick={handleCompleteRide}
            className="btn-success w-full mt-4"
          >
            ✅ Mark Trip Completed
          </button>
        </div>
      )}

      {/* Incoming requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">
            Incoming Requests
          </h3>
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            {requests.length}
          </span>
        </div>

        {requests.length === 0 && !activeRide && (
          <div className="card text-center py-10">
            <p className="text-3xl mb-3">🕐</p>
            <p className="text-gray-300 font-medium">No pending requests</p>
            <p className="text-gray-500 text-sm mt-1">
              New ride requests will appear here automatically.
            </p>
          </div>
        )}

        {requests.length === 0 && activeRide && (
          <div className="card text-center py-6">
            <p className="text-gray-500 text-sm">No additional requests while on a trip.</p>
          </div>
        )}

        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.ride_id} className="card">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-900/50 rounded-full flex items-center justify-center text-blue-400 text-lg flex-shrink-0">
                  🛎️
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-medium">New ride request</p>
                    <span className="text-xs text-gray-500">
                      {req.distance_km?.toFixed(1)} km away
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-0.5">
                    Rider: {req.rider_id}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    {req.rider_lat?.toFixed(4)}°N, {req.rider_lng?.toFixed(4)}°E
                  </p>
                  <code className="text-xs text-gray-600">{req.ride_id}</code>
                </div>
              </div>

              <button
                onClick={() => handleAccept(req)}
                disabled={accepting === req.ride_id || activeRide !== null}
                className="btn-success w-full mt-4 flex items-center justify-center gap-2"
              >
                {accepting === req.ride_id ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Accepting…
                  </>
                ) : activeRide ? (
                  "Finish current trip first"
                ) : (
                  "✅ Accept Ride"
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Info footer */}
      <div className="text-xs text-gray-600 border-t border-gray-800 pt-4">
        Accepting a ride emits a <code>ride-accepted</code> Kafka event → Trip Service → MongoDB (with circuit breaker).
      </div>
    </div>
  );
}
