import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import toast from "react-hot-toast";

const ROLE_REDIRECT = { RIDER: "/rider", DRIVER: "/driver", ADMIN: "/admin" };

// Quick-login presets for demo purposes
const DEMO_CREDENTIALS = [
  { label: "Rider",    username: "rider1",  password: "pass123", role: "RIDER"  },
  { label: "Driver 1", username: "driver1", password: "pass123", role: "DRIVER" },
  { label: "Driver 2", username: "driver2", password: "pass123", role: "DRIVER" },
];

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const user = await login(username.trim(), password);
      toast.success(`Welcome, ${user.username}!`);
      navigate(ROLE_REDIRECT[user.role] || "/rider");
    } catch (err) {
      toast.error(err.message || "Login failed");
    }
  }

  async function handleDemoLogin(cred) {
    try {
      const user = await login(cred.username, cred.password);
      toast.success(`Logged in as ${user.username} (${user.role})`);
      navigate(ROLE_REDIRECT[user.role] || "/rider");
    } catch (err) {
      // Backend may not be running — skip auth and use role directly
      const mockUser = { id: cred.username, username: cred.username, role: cred.role };
      localStorage.setItem("velocity_user", JSON.stringify(mockUser));
      toast(`Demo mode: logged in as ${cred.username}`, { icon: "🔧" });
      navigate(ROLE_REDIRECT[cred.role] || "/rider");
      window.location.reload();
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-brand-gold rounded-2xl items-center justify-center text-white font-bold text-3xl mb-4">
            V
          </div>
          <h1 className="text-2xl font-bold text-white">Project Velocity</h1>
          <p className="text-gray-400 text-sm mt-1">Ride-hailing tracker dashboard</p>
        </div>

        {/* Login card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-6">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Username</label>
              <input
                type="text"
                className="input-field"
                placeholder="rider1 / driver1 / driver2 …"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Demo login shortcuts */}
          <div className="mt-6 pt-5 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-3">Quick demo access (password: <code className="text-gray-400">pass123</code>)</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_CREDENTIALS.map((cred) => (
                <button
                  key={cred.username}
                  onClick={() => handleDemoLogin(cred)}
                  disabled={loading}
                  className="text-xs py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
                >
                  <div className="font-medium">{cred.label}</div>
                  <div className="text-gray-500 mt-0.5">{cred.username}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Admin view is accessible via the sidebar after login.
        </p>
      </div>
    </div>
  );
}
