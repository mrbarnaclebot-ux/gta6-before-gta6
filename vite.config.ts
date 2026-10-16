import { defineConfig } from 'vitest/config'
import { assetManifest } from './scripts/build-assets.ts'

export default defineConfig({
  // ponytail: Rapier compat inlines its WASM as base64 (about 4 MB); it is lazy-loaded
  // after the title screen. Switch to the non-compat package if load time matters.
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
    // Hashed output goes to /build (cached forever); /assets is public/assets, names kept.
    assetsDir: 'build',
    rolldownOptions: {
      input: { main: 'index.html', sw: 'src/sw/sw.ts' },
      // The service worker needs a fixed URL at the site root to control every page.
      output: { entryFileNames: (c) => (c.name === 'sw' ? 'sw.js' : 'build/[name]-[hash].js') },
    },
  },
  worker: { format: 'es' },
  plugins: [assetManifest()],
  test: { include: ['src/**/*.test.ts'] },
})
