import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/identity": { target: "http://localhost:4001", rewrite: (p) => p.replace(/^\/api\/identity/, "") },
      "/api/matching": { target: "http://localhost:4004", rewrite: (p) => p.replace(/^\/api\/matching/, "") },
    },
  },
});
