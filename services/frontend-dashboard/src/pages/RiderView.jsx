import React, { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth.jsx";
import { useTripStatus } from "../hooks/useTripStatus.js";
import { requestRide } from "../services/rideService.js";
import StatusBadge from "../components/StatusBadge.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

const DEFAULT_COORDS = { lat: 19.076, lng: 72.8777 }; // Mumbai

export default function RiderView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rideData, setRideData] = useState(null); // { ride_id, nearest_drivers }
  const [uiStatus, setUiStatus] = useState(null);

  // Subscribe to realtime trip updates from WebSocket/SSE
  const realtimeStatus = useTripStatus(rideData?.ride_id);

  // Merge local and realtime status
  const displayStatus = realtimeStatus || uiStatus;

  async function handleRequestRide() {
    setLoading(true);
    setError(null);
    setRideData(null);
    setUiStatus("Searching");
    const toastId = toast.loading("Finding nearest drivers...");

    try {
      const riderId = user?.id || "rider-001";
      const data = await requestRide({ rider_id: riderId, ...DEFAULT_COORDS });
      setRideData(data);
      setUiStatus("Assigned");
      toast.success(`Ride requested! ID: ${data.ride_id}`, { id: toastId });
    } catch (err) {
      const msg = err.message || "Failed to request ride";
      setError(msg);
      setUiStatus(null);
      toast.error(msg, { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  function handleCancelRide() {
    setRideData(null);
    setUiStatus(null);
    setError(null);
    toast("Ride cancelled", { icon: "🚫" });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Rider Dashboard</h2>
        <p className="text-gray-400 text-sm mt-1">
          Welcome{user ? `, ${user.username}` : ""}. Request a ride to get started.
        </p>
      </div>

      {/* Trip status card */}
      {(displayStatus || error) && (
        <div className={`card border-l-4 ${error ? "border-l-red-500" : displayStatus === "Syncing..." ? "border-l-yellow-500" : "border-l-brand-gold"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Trip Status</p>
              {displayStatus && <StatusBadge status={displayStatus} />}
              {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
              {rideData && (
                <p className="text-xs text-gray-500 mt-2">
                  Ride ID: <code className="text-gray-400">{rideData.ride_id}</code>
                </p>
              )}
              {displayStatus === "Syncing..." && (
                <p className="text-yellow-400 text-xs mt-2">
                  Backend is syncing your trip — this may take a moment.
                </p>
              )}
            </div>
            {rideData && (
              <button onClick={handleCancelRide} className="btn-secondary text-xs py-1.5 px-3">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Request ride card */}
      {!rideData && (
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-brand-gold/10 rounded-lg flex items-center justify-center text-brand-gold text-lg flex-shrink-0">
              🚕
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">Request a Ride</h3>
              <p className="text-gray-400 text-sm mt-0.5">
                Location: Mumbai (19.076°N, 72.878°W)
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Searching within 5 km radius
              </p>
            </div>
          </div>

          <button
            onClick={handleRequestRide}
            disabled={loading}
            className="btn-primary w-full mt-5 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Searching for drivers…
              </>
            ) : (
              <>🚕 Request Ride</>
            )}
          </button>
        </div>
      )}

      {/* Nearest drivers */}
      {loading && !rideData && (
        <LoadingSpinner message="Finding nearest drivers..." />
      )}

      {rideData?.nearest_drivers?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            Nearest Drivers ({rideData.nearest_drivers.length})
          </h3>
          <div className="space-y-3">
            {rideData.nearest_drivers.map((d, idx) => (
              <div key={d.driver_id} className="card flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-900/50 rounded-full flex items-center justify-center text-emerald-400 font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Driver {d.driver_id}</p>
                  <p className="text-gray-400 text-sm">
                    {d.distance_km !== null && d.distance_km !== undefined ? d.distance_km.toFixed(2) : "—"} km away
                  </p>
                  {d.lat && d.lng && (
                    <p className="text-gray-600 text-xs mt-0.5">
                      {d.lat.toFixed(4)}°N, {d.lng.toFixed(4)}°E
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rideData?.nearest_drivers?.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-3xl mb-3">😔</p>
          <p className="text-gray-300 font-medium">No drivers nearby</p>
          <p className="text-gray-500 text-sm mt-1">Try again in a moment.</p>
          <button onClick={() => setRideData(null)} className="btn-secondary mt-4 text-sm">
            Try Again
          </button>
        </div>
      )}

      {/* Info footer */}
      <div className="text-xs text-gray-600 border-t border-gray-800 pt-4">
        Trip lifecycle: Searching → Assigned → <span className="text-yellow-600">Syncing...</span> (on MongoDB fallback) → Completed
      </div>
    </div>
  );
}
