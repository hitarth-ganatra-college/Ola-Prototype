import React, { useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
  ],
};

/**
 * Reusable Google Maps component.
 *
 * Props:
 *   center         – { lat, lng }
 *   zoom           – number
 *   markers        – [{ id, lat, lng, label?, draggable?, isManual?, infoContent? }]
 *   onMarkerDrag   – (id, { lat, lng }) => void
 *   onClick        – ({ lat, lng }) => void
 *   children       – additional Google Maps child components
 */
export default function MapView({
  center = { lat: 19.076, lng: 72.8777 },
  zoom = 13,
  markers = [],
  onMarkerDrag,
  onClick,
  children,
}) {
  if (!API_KEY || API_KEY === "YOUR_KEY_HERE") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded-xl border border-dashed border-gray-600 gap-4 p-8">
        <span className="text-4xl">🗺️</span>
        <div className="text-center">
          <p className="text-white font-semibold text-lg">Google Maps not configured</p>
          <p className="text-gray-400 text-sm mt-1">
            Add <code className="bg-gray-700 px-1.5 py-0.5 rounded text-yellow-400">VITE_GOOGLE_MAPS_API_KEY</code> to your{" "}
            <code className="bg-gray-700 px-1.5 py-0.5 rounded text-yellow-400">.env</code> file.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Copy <code className="text-gray-400">.env.example</code> → <code className="text-gray-400">.env</code> and replace the placeholder key.
          </p>
        </div>
        {/* Fallback driver list */}
        {markers.length > 0 && (
          <div className="w-full max-w-md mt-2">
            <p className="text-gray-400 text-xs mb-2 text-center">{markers.length} active drivers (map unavailable)</p>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {markers.map((m) => (
                <div key={m.id} className="bg-gray-700 rounded px-3 py-1.5 text-xs text-gray-300 flex items-center gap-2">
                  <span className={m.isManual ? "text-yellow-400" : "text-emerald-400"}>●</span>
                  {m.id}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <MapLoader
      center={center}
      zoom={zoom}
      markers={markers}
      onMarkerDrag={onMarkerDrag}
      onClick={onClick}
    >
      {children}
    </MapLoader>
  );
}

function MapLoader({ center, zoom, markers, onMarkerDrag, onClick, children }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
    libraries: ["marker"],
  });

  const handleMarkerDragEnd = useCallback(
    (id, e) => {
      if (onMarkerDrag) {
        onMarkerDrag(id, { lat: e.latLng.lat(), lng: e.latLng.lng() });
      }
    },
    [onMarkerDrag]
  );

  const handleMapClick = useCallback(
    (e) => {
      if (onClick) {
        onClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }
    },
    [onClick]
  );

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-xl text-red-400">
        <p>Failed to load Google Maps: {loadError.message}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-xl">
        <div className="w-8 h-8 border-4 border-gray-600 border-t-brand-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={center}
      zoom={zoom}
      options={MAP_OPTIONS}
      onClick={handleMapClick}
    >
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={{ lat: m.lat, lng: m.lng }}
          draggable={m.draggable || false}
          onDragEnd={(e) => handleMarkerDragEnd(m.id, e)}
          label={m.label ? { text: m.label, color: "#ffffff", fontSize: "11px" } : undefined}
          icon={
            m.isManual
              ? {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 9,
                  fillColor: "#e94560",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                }
              : {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 7,
                  fillColor: "#10b981",
                  fillOpacity: 0.9,
                  strokeColor: "#ffffff",
                  strokeWeight: 1.5,
                }
          }
        />
      ))}
      {children}
    </GoogleMap>
  );
}
