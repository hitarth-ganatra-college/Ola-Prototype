import React, { useState } from "react";

export default function DriverView() {
  const [rideId, setRideId] = useState("");
  const [status, setStatus] = useState(null);

  function acceptRide() {
    if (!rideId.trim()) {
      setStatus("Enter a ride ID");
      return;
    }
    // In a real app this would call the trip-service / emit a Kafka event
    setStatus(`✅ Ride ${rideId} accepted! (event emitted)`);
  }

  return (
    <div>
      <h2>Driver View</h2>
      <p>Welcome, Driver! Incoming ride requests will appear here.</p>
      <input
        type="text"
        placeholder="Ride ID"
        value={rideId}
        onChange={(e) => setRideId(e.target.value)}
        style={{ marginRight: "0.5rem" }}
      />
      <button onClick={acceptRide}>✅ Accept Ride</button>
      {status && <p>{status}</p>}
    </div>
  );
}
