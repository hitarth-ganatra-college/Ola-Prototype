/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1a1a2e",
          light: "#16213e",
          accent: "#0f3460",
          gold: "#e94560",
        },
      },
    },
  },
  plugins: [],
};
