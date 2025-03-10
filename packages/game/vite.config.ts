import { resolve } from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@scuffed-mmorpg/common": resolve(__dirname, "../common/src"),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy WebRTC signaling requests to the game server
      "/.wrtc": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  publicDir: "public",
});
