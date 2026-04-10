import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

const NAV_ITEMS = [
  { role: "RIDER",  path: "/rider",  label: "🚕 Rider",  emoji: "🚕" },
  { role: "DRIVER", path: "/driver", label: "🚗 Driver", emoji: "🚗" },
  { role: "ADMIN",  path: "/admin",  label: "🗺️ Admin",  emoji: "🗺️" },
  { role: "ADMIN",  path: "/kafka-monitor",  label: "📡 Kafka",  emoji: "📡" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-gold rounded-lg flex items-center justify-center text-white font-bold text-lg">
              V
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">Project Velocity</p>
              <p className="text-xs text-gray-500">Ride-hailing tracker</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.role}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-brand-gold text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span>{item.emoji}</span>
                {item.label.split(" ").slice(1).join(" ")} View
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-gray-800">
          {user ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{user.username}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  user.role === "RIDER"  ? "bg-blue-900 text-blue-300" :
                  user.role === "DRIVER" ? "bg-emerald-900 text-emerald-300" :
                  "bg-purple-900 text-purple-300"
                }`}>
                  {user.role}
                </span>
              </div>
              <button
                onClick={logout}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Not logged in</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <h1 className="text-white font-semibold text-lg capitalize">
            {location.pathname.replace("/", "") || "Dashboard"} View
          </h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
