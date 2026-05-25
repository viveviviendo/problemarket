import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#090c0b",
        panel: "#101715",
        line: "#1d2925",
        neon: "#00ff88",
        danger: "#ff6577",
        muted: "#8b9d97"
      },
      boxShadow: {
        glow: "0 0 34px rgba(0,255,136,.14)"
      }
    }
  },
  plugins: []
};

export default config;
