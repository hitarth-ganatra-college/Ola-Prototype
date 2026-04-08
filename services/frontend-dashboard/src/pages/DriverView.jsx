import React, { useMemo, useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth.jsx";
import { useDriverLocations } from "../hooks/useDriverLocations.js";
import { acceptRide, completeRide, getDriverRequests, updateDriverRequestAction } from "../services/rideService.js";
import { useTripStatus } from "../hooks/useTripStatus.js";
import StatusBadge from "../components/StatusBadge.jsx";
import { DRIVER_PROFILE_IDS } from "../constants/drivers.js";

export default function DriverView() {
  const { user } = useAuth();
  const liveLocations = useDriverLocations();
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [requests, setRequests] = useState([]);
  const [activeRides, setActiveRides] = useState({});
  const [accepting, setAccepting] = useState(null); // ride_id being accepted
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [rejecting, setRejecting] = useState(null);

  const driverOptions = useMemo(() => {
    const ids = new Set([
      ...(user?.id ? [user.id] : []),
      ...DRIVER_PROFILE_IDS,
      ...Object.keys(liveLocations),
    ]);
    return Array.from(ids).sort();
  }, [liveLocations, user?.id]);

  useEffect(() => {
    if (!selectedDriverId) {
      setSelectedDriverId(user?.id || driverOptions[0] || "");
      return;
    }
    if (!driverOptions.includes(selectedDriverId)) {
      setSelectedDriverId(driverOptions[0] || "");
    }
  }, [driverOptions, selectedDriverId, user?.id]);

  const activeRide = selectedDriverId ? activeRides[selectedDriverId] || null : null;

  const realtimeStatus = useTripStatus(activeRide?.ride_id);
  const displayStatus = realtimeStatus || activeRide?.status;

  const fetchRequests = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedDriverId) return;
      if (!silent) setLoadingRequests(true);
      try {
        const data = await getDriverRequests(selectedDriverId);
        setRequests(data.requests || []);
      } catch (err) {
        if (!silent) toast.error(err.message || "Failed to load driver requests");
      } finally {
        if (!silent) setLoadingRequests(false);
      }
    },
    [selectedDriverId]
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!selectedDriverId) return;
    const id = setInterval(() => fetchRequests({ silent: true }), 5000);
    return () => clearInterval(id);
  }, [fetchRequests, selectedDriverId]);

  async function handleAccept(rideReq) {
    setAccepting(rideReq.ride_id);
    const toastId = toast.loading(`Accepting ride ${rideReq.ride_id}…`);
    try {
      await updateDriverRequestAction({
        driver_id: selectedDriverId,
        ride_id: rideReq.ride_id,
        action: "accept",
      });
      await acceptRide({
        ride_id: rideReq.ride_id,
        driver_id: selectedDriverId,
        rider_id: rideReq.rider_id,
      });
      setActiveRides((prev) => ({
        ...prev,
        [selectedDriverId]: { ...rideReq, status: "ACCEPTED", driver_id: selectedDriverId },
      }));
      setRequests((prev) => prev.filter((r) => r.ride_id !== rideReq.ride_id));
      toast.success("Ride accepted!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to accept ride", { id: toastId });
    } finally {
      setAccepting(null);
    }
  }

  async function handleReject(rideReq) {
    setRejecting(rideReq.ride_id);
    try {
      await updateDriverRequestAction({
        driver_id: selectedDriverId,
        ride_id: rideReq.ride_id,
        action: "reject",
      });
      setRequests((prev) => prev.filter((r) => r.ride_id !== rideReq.ride_id));
      toast("Ride request rejected", { icon: "🛑" });
    } catch (err) {
      toast.error(err.message || "Failed to reject ride request");
    } finally {
      setRejecting(null);
    }
  }

  async function handleCompleteRide() {
    if (!activeRide) return;
    try {
      await completeRide({
        ride_id: activeRide.ride_id,
        driver_id: selectedDriverId,
        distance_km: activeRide.distance_km,
      });
      toast.success("Trip completed!");
      setActiveRides((prev) => {
        const next = { ...prev };
        delete next[selectedDriverId];
        return next;
      });
    } catch (err) {
      toast.error(err.message || "Failed to complete trip");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Driver Dashboard</h2>
        <p className="text-gray-400 text-sm mt-1">
          Welcome{user ? `, ${user.username}` : ""}. Choose a driver profile and manage incoming requests.
        </p>
      </div>

      <div className="card">
        <label className="block text-xs text-gray-400 mb-1.5">Acting as driver</label>
        <select
          className="input-field"
          value={selectedDriverId}
          onChange={(e) => setSelectedDriverId(e.target.value)}
        >
          {driverOptions.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
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
            <p className="text-gray-300 font-medium">
              {loadingRequests ? "Loading requests..." : "No pending requests"}
            </p>
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

              <button
                onClick={() => handleReject(req)}
                disabled={rejecting === req.ride_id || activeRide !== null}
                className="w-full mt-2 text-sm py-2.5 px-4 rounded-lg font-medium bg-red-900/30 border border-red-700/50 text-red-300 hover:bg-red-900/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {rejecting === req.ride_id ? "Rejecting..." : "🛑 Reject Ride"}
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
