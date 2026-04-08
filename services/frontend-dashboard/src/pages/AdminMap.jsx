import React from "react";

export default function AdminMap() {
  return (
    <div>
      <h2>Admin / Debug Map</h2>
      <p>
        This view would embed a Google Maps (or Leaflet) component showing all 50+ simulated driver
        markers in real-time via WebSocket. Manual-driver markers (driver-001 to driver-004) are
        draggable — dragging sets a Redis <code>driver:manual:&lt;id&gt;</code> flag and pushes
        coordinates directly, pausing the simulation for that driver.
      </p>
      <p>
        <strong>To implement the full map:</strong> Add your Google Maps API key to{" "}
        <code>.env</code> and integrate <code>@react-google-maps/api</code> or <code>leaflet</code>.
      </p>
      <div
        style={{
          border: "2px dashed #ccc",
          borderRadius: 8,
          height: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#888",
          fontSize: "1.2rem",
        }}
      >
        🗺️ Map Placeholder — integrate Google Maps or Leaflet here
      </div>
    </div>
  );
}
