import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // Hardcoded, never from an env var: `npx vite build` and
  // `npx vite preview --base /decision-lab/` must both work with no setup.
  base: command === "build" ? "/decision-lab/" : "/",
  server: {
    host: "::",
    port: 8128,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // registration is handled with a guard in main.tsx
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^blob:/, /^data:/],
        // og-image.png is only ever fetched by social scrapers from the live
        // server, never by the app — keep it out of the offline precache.
        globIgnores: ["**/og-image.png"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
