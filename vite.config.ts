import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** WSL2 often misses FS events; polling makes HMR reliable when editing from Windows/Cursor. */
const isWsl = Boolean(process.env.WSL_DISTRO_NAME);

export default defineConfig({
  plugins: [react()],
  server: {
    watch: isWsl ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
