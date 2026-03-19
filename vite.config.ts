// vite.config.ts — ananke-world-ui
//
// Pure browser build; no server-side rendering, no Node polyfills needed.
// The Ananke simulation runs entirely in the browser via the ESM export.

import { defineConfig } from "vite";

export default defineConfig({
  // Base path for GitHub Pages deployment, if used.
  // Change to "/" if serving from the domain root.
  base: "./",

  build: {
    target: "es2022",
    outDir: "dist",
    // Source maps aid debugging simulation output in DevTools
    sourcemap: true,
  },

  server: {
    port: 5173,
    open: true,
  },
});
