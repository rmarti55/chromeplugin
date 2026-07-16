import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes all asset URLs relative so the built page works when loaded
// from chrome-extension://<id>/dashboard/dist/index.html.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 3000,
    // db.js / categorize.js live in the parent extension/ dir (shared with the
    // service worker), so let the dev server read outside the dashboard root.
    fs: { allow: [".."] },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
