import { defineConfig } from 'vitest/config'

export default defineConfig({
  // ponytail: Rapier compat inlines its WASM as base64 (about 4 MB); it is lazy-loaded
  // after the title screen. Switch to the non-compat package if load time matters.
  build: { target: 'es2022', chunkSizeWarningLimit: 6000 },
  test: { include: ['src/**/*.test.ts'] },
})
