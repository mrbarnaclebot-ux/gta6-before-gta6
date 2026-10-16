# scripts

- `setup.sh` install dependencies and Playwright's Chromium; `dev.sh` the dev server; `test.sh` everything CI runs
- `perf.mjs` (with `perf-lib.mjs`) cold and warm load times, transfer, memory, and frame-time percentiles in fixed scenes and on a drive round the highway
- `build-assets.ts` Vite plugin for production builds: `asset-manifest.json` (content hashes for the service worker) and precompressed `.br`/`.gz` files for Caddy
- `audio.mjs` (with `audio-lib.mjs`) rebuilds `public/assets/audio` from the raw Epidemic Sound downloads: `node scripts/audio.mjs <download dir>` (needs ffmpeg)
