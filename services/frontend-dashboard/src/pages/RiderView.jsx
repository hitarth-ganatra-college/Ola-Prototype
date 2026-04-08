import React, { useState } from "react";

export default function RiderView() {
  const [status, setStatus] = useState(null);
  const [drivers, setDrivers] = useState([]);

  async function requestRide() {
    setStatus("Searching...");
    try {
      const res = await fetch("/api/matching/request-ride", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rider_id: "rider-001", lat: 19.076, lng: 72.8777 }),
      });
      const data = await res.json();
      if (data.nearest_drivers) {
        setDrivers(data.nearest_drivers);
        setStatus(`Ride requested! ID: ${data.ride_id}`);
      } else {
        setStatus(data.error || "No drivers found");
      }
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  }

  return (
    <div>
      <h2>Rider View</h2>
      <button onClick={requestRide}>🚕 Request Ride</button>
      {status && <p><strong>Status:</strong> {status}</p>}
      {drivers.length > 0 && (
        <ul>
          {drivers.map((d) => (
            <li key={d.driver_id}>
              Driver {d.driver_id} — {d.distance_km.toFixed(2)} km away
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
