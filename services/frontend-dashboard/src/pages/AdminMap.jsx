import React, { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { useDriverLocations } from "../hooks/useDriverLocations.js";
import { getActiveDrivers, getManualOverrides, pushManualLocation, toggleManualOverride } from "../services/driverService.js";
import MapView from "../components/MapView.jsx";

// The 4 manual-override driver IDs seeded in the identity service
const MANUAL_DRIVER_IDS = ["driver-001", "driver-002", "driver-003", "driver-004"];

export default function AdminMap() {
  const liveLocations = useDriverLocations(); // all drivers
  const [manualToggles, setManualToggles] = useState({}); // { driver_id: true/false }
  const [manualCoords, setManualCoords] = useState({}); // { driver_id: { lat: "", lng: "" } }
  const [serverDrivers, setServerDrivers] = useState({});
  const [driverCount, setDriverCount] = useState(0);

  const mergedLocations = useMemo(
    () => ({ ...serverDrivers, ...liveLocations }),
    [serverDrivers, liveLocations]
  );

  const selectableDriverIds = useMemo(() => {
    const ids = new Set([
      ...MANUAL_DRIVER_IDS,
      ...Object.keys(mergedLocations),
      ...Object.keys(manualToggles),
    ]);
    return Array.from(ids).sort();
  }, [mergedLocations, manualToggles]);

  async function hydrateManualState() {
    try {
      const [drivers, overrides] = await Promise.all([getActiveDrivers(), getManualOverrides()]);
      const driverMap = {};
      const nextManual = {};
      for (const driver of drivers) {
        driverMap[driver.driver_id] = driver;
        if (driver.isManual) nextManual[driver.driver_id] = true;
      }
      for (const id of overrides?.driver_ids || []) nextManual[id] = true;
      setServerDrivers(driverMap);
      setManualToggles((prev) => ({ ...prev, ...nextManual }));
    } catch {
      // backend may be offline
    }
  }

  // Build marker list from live locations
  const markers = Object.values(mergedLocations).map((loc) => ({
    id: loc.driver_id,
    lat: loc.lat,
    lng: loc.lng,
    isManual: !!manualToggles[loc.driver_id],
    draggable: !!manualToggles[loc.driver_id],
    label: loc.driver_id.startsWith("driver-") ? loc.driver_id.replace("driver-", "D") : loc.driver_id,
  }));

  useEffect(() => {
    setDriverCount(Object.keys(mergedLocations).length);
  }, [mergedLocations]);

  useEffect(() => {
    hydrateManualState();
  }, []);

  useEffect(() => {
    setManualCoords((prev) => {
      const next = { ...prev };
      for (const [driverId, loc] of Object.entries(mergedLocations)) {
        if (!next[driverId]) {
          next[driverId] = {
            lat: Number.isFinite(loc.lat) ? String(loc.lat) : "",
            lng: Number.isFinite(loc.lng) ? String(loc.lng) : "",
          };
        }
      }
      return next;
    });
  }, [mergedLocations]);

  const handleMarkerDrag = useCallback(
    async (driverId, { lat, lng }) => {
      try {
        await pushManualLocation({ driver_id: driverId, lat, lng });
        setServerDrivers((prev) => ({ ...prev, [driverId]: { driver_id: driverId, lat, lng, isManual: true } }));
        setManualCoords((prev) => ({ ...prev, [driverId]: { lat: String(lat), lng: String(lng) } }));
        toast.success(`Updated location for ${driverId}`);
      } catch {
        // Backend not running — show demo feedback
        toast(`Demo: location pushed for ${driverId} (${lat.toFixed(4)}, ${lng.toFixed(4)})`, { icon: "📍" });
      }
    },
    []
  );

  async function handleToggleOverride(driverId) {
    const newState = !manualToggles[driverId];
    setManualToggles((prev) => ({ ...prev, [driverId]: newState }));
    try {
      await toggleManualOverride({ driver_id: driverId, enabled: newState });
      if (newState) {
        const loc = mergedLocations[driverId];
        if (loc) {
          setManualCoords((prev) => ({
            ...prev,
            [driverId]: { lat: String(loc.lat), lng: String(loc.lng) },
          }));
        }
      }
      toast.success(`Manual override ${newState ? "enabled" : "disabled"} for ${driverId}`);
    } catch {
      toast(`Demo: override ${newState ? "on" : "off"} for ${driverId}`, { icon: "🔧" });
    }
  }

  async function handleApplyManualLocation(driverId) {
    const raw = manualCoords[driverId] || {};
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Enter valid numeric latitude and longitude");
      return;
    }
    try {
      await pushManualLocation({ driver_id: driverId, lat, lng });
      setServerDrivers((prev) => ({ ...prev, [driverId]: { driver_id: driverId, lat, lng, isManual: true } }));
      toast.success(`Manual coordinates saved for ${driverId}`);
    } catch (err) {
      toast.error(err.message || "Failed to save manual coordinates");
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header + stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Admin / Debug Map</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Live driver positions with manual override controls and coordinate inputs.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="card py-2 px-4 text-center">
            <p className="text-2xl font-bold text-white">{driverCount}</p>
            <p className="text-xs text-gray-500">Active drivers</p>
          </div>
          <div className="card py-2 px-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">
              {Object.values(manualToggles).filter(Boolean).length}
            </p>
            <p className="text-xs text-gray-500">Manual override</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden" style={{ minHeight: 480 }}>
          <MapView
            center={{ lat: 19.076, lng: 72.8777 }}
            zoom={13}
            markers={markers}
            onMarkerDrag={handleMarkerDrag}
          />
        </div>

        {/* Sidebar: manual driver controls */}
        <div className="w-64 flex flex-col gap-3 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-300">Manual Driver Controls</h3>
          <p className="text-xs text-gray-500 -mt-1">
            Enable override to drag a marker and push coordinates to Redis.
          </p>

          {selectableDriverIds.map((id) => {
            const isManual = !!manualToggles[id];
            const loc = mergedLocations[id];
            return (
              <div
                key={id}
                className={`card border ${isManual ? "border-yellow-700/50 bg-yellow-950/20" : "border-gray-800"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${loc ? "bg-emerald-400" : "bg-gray-600"}`} />
                    <span className="text-sm font-medium text-white">{id}</span>
                  </div>
                  {isManual && (
                    <span className="text-xs bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded">
                      Manual
                    </span>
                  )}
                </div>

                {loc ? (
                  <p className="text-xs text-gray-500 mb-3">
                    {loc.lat.toFixed(4)}°N, {loc.lng.toFixed(4)}°E
                  </p>
                ) : (
                  <p className="text-xs text-gray-600 mb-3">No location data</p>
                )}

                <button
                  onClick={() => handleToggleOverride(id)}
                  className={`w-full text-xs py-1.5 px-3 rounded-lg font-medium transition-colors border ${
                    isManual
                      ? "bg-yellow-900/40 border-yellow-700 text-yellow-300 hover:bg-yellow-900/60"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {isManual ? "🔴 Disable Override" : "🟡 Enable Override"}
                </button>

                {isManual && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="any"
                        value={manualCoords[id]?.lat ?? ""}
                        onChange={(e) =>
                          setManualCoords((prev) => ({
                            ...prev,
                            [id]: { ...(prev[id] || {}), lat: e.target.value },
                          }))
                        }
                        placeholder="Latitude"
                        className="input-field text-xs py-1.5"
                      />
                      <input
                        type="number"
                        step="any"
                        value={manualCoords[id]?.lng ?? ""}
                        onChange={(e) =>
                          setManualCoords((prev) => ({
                            ...prev,
                            [id]: { ...(prev[id] || {}), lng: e.target.value },
                          }))
                        }
                        placeholder="Longitude"
                        className="input-field text-xs py-1.5"
                      />
                    </div>
                    <button
                      onClick={() => handleApplyManualLocation(id)}
                      className="w-full text-xs py-1.5 px-3 rounded-lg font-medium bg-brand-gold/20 border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/30"
                    >
                      Save Coordinates
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Legend */}
          <div className="card mt-2">
            <p className="text-xs font-semibold text-gray-400 mb-2">Legend</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                Simulated drivers
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-full bg-brand-gold inline-block" />
                Manual-override drivers
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
