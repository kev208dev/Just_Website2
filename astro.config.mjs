// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages serves this project from https://kev208dev.github.io/Just_Website2/
export default defineConfig({
  site: 'https://kev208dev.github.io',
  base: '/Just_Website2/',
  trailingSlash: 'ignore',
  // Class strategy lets parent-scoped styles reach child components that receive `class`.
  scopedStyleStrategy: 'class',
  build: {
    format: 'directory',
    assets: '_assets',
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 900,
    },
  },
});
