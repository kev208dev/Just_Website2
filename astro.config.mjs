// @ts-check
import { defineConfig } from "astro/config";

/**
 * GitHub Pages serves this project from a sub path (https://kev208dev.github.io/Just_Website2/).
 * CI passes BASE_PATH derived from the real repository name so the path always matches;
 * the fallback keeps local builds identical to production.
 */
const base = process.env.BASE_PATH || "/Just_Website2/";

export default defineConfig({
  site: process.env.SITE_URL || "https://kev208dev.github.io",
  base,
  trailingSlash: "always",
  output: "static",
  build: {
    format: "directory",
    assets: "_assets",
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "hover",
  },
  vite: {
    build: {
      // three.js is intentionally split into its own chunk and only loaded on the home page.
      chunkSizeWarningLimit: 900,
    },
  },
});
