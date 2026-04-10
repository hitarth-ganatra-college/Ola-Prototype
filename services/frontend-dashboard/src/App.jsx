import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RiderView from "./pages/RiderView.jsx";
import DriverView from "./pages/DriverView.jsx";
import AdminMap from "./pages/AdminMap.jsx";
import KafkaTopicsView from "./pages/KafkaTopicsView.jsx";
import { connect, disconnect } from "./ws/socketClient.js";

// Start the realtime adapter once on mount
function RealtimeBootstrap() {
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);
  return null;
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <>
      <RealtimeBootstrap />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout>
                <Routes>
                  <Route path="/rider"  element={<RiderView />} />
                  <Route path="/driver" element={<DriverView />} />
                  <Route path="/admin"  element={<AdminMap />} />
                  <Route path="/kafka-monitor" element={<KafkaTopicsView />} />
                  <Route path="*"       element={<Navigate to="/rider" replace />} />
                </Routes>
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
