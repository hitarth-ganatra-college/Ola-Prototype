import React, { useCallback } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMapEvents } from "react-leaflet";

const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY;
const MAPTILER_TILE_URL = `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY || ""}`;
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.maptiler.com/">MapTiler</a>';

function buildDriverIcon(isManual) {
  const size = isManual ? 18 : 14;
  const color = isManual ? "#e94560" : "#10b981";
  return L.divIcon({
    className: "driver-marker-wrapper",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(event) {
      if (!onClick) return;
      onClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

export default function MapView({
  center = { lat: 19.076, lng: 72.8777 },
  zoom = 13,
  markers = [],
  onMarkerDrag,
  onClick,
  children,
}) {
  const handleMarkerDragEnd = useCallback(
    (id, event) => {
      if (!onMarkerDrag) return;
      const next = event.target.getLatLng();
      onMarkerDrag(id, { lat: next.lat, lng: next.lng });
    },
    [onMarkerDrag]
  );

  if (!MAPTILER_API_KEY || MAPTILER_API_KEY === "YOUR_KEY_HERE") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded-xl border border-dashed border-gray-600 gap-4 p-8">
        <span className="text-4xl">🗺️</span>
        <div className="text-center">
          <p className="text-white font-semibold text-lg">MapTiler not configured</p>
          <p className="text-gray-400 text-sm mt-1">
            Add <code className="bg-gray-700 px-1.5 py-0.5 rounded text-yellow-400">VITE_MAPTILER_API_KEY</code> to your{" "}
            <code className="bg-gray-700 px-1.5 py-0.5 rounded text-yellow-400">.env</code> file.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Copy <code className="text-gray-400">.env.example</code> → <code className="text-gray-400">.env</code> and replace the placeholder key.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer center={center} zoom={zoom} className="w-full h-full" zoomControl>
      <TileLayer attribution={MAP_ATTRIBUTION} url={MAPTILER_TILE_URL} />
      <MapClickHandler onClick={onClick} />
      {markers
        .filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng))
        .map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            draggable={Boolean(marker.draggable)}
            icon={buildDriverIcon(Boolean(marker.isManual))}
            eventHandlers={{
              dragend: (event) => handleMarkerDragEnd(marker.id, event),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              {marker.label || marker.id}
            </Tooltip>
          </Marker>
        ))}
      {children}
    </MapContainer>
  );
}
