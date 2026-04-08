import React, { useState } from "react";
import RiderView from "./pages/RiderView.jsx";
import DriverView from "./pages/DriverView.jsx";
import AdminMap from "./pages/AdminMap.jsx";

export default function App() {
  const [view, setView] = useState("rider");

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <h1>🚗 Project Velocity Dashboard</h1>
      <nav style={{ marginBottom: "1rem" }}>
        {["rider", "driver", "admin"].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{ marginRight: "0.5rem", fontWeight: view === v ? "bold" : "normal" }}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)} View
          </button>
        ))}
      </nav>
      {view === "rider" && <RiderView />}
      {view === "driver" && <DriverView />}
      {view === "admin" && <AdminMap />}
    </div>
  );
}
