import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /**
     * Vite forwards browser `unhandledrejection` to the terminal. Some tooling
     * rejects with `undefined`, which shows as "Unknown Error: undefined".
     * Keep normal console forwarding; only skip unhandled rejections.
     */
    forwardConsole: {
      unhandledErrors: false,
      logLevels: ["error", "warn", "info", "log", "debug"],
    },
  },
  optimizeDeps: {
    exclude: ["essentia.js"],
  },
});
