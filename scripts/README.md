# scripts

- `setup.sh` install dependencies and Playwright's Chromium; `dev.sh` the dev server; `test.sh` everything CI runs
- `perf.mjs` (with `perf-lib.mjs`) cold and warm load times, transfer, memory, and frame-time percentiles in fixed scenes and on a drive round the highway
- `build-assets.ts` Vite plugin for production builds: `asset-manifest.json` (content hashes for the service worker) and precompressed `.br`/`.gz` files for Caddy
- `audio.mjs` (with `audio-lib.mjs`) rebuilds `public/assets/audio` from the raw Epidemic Sound downloads: `node scripts/audio.mjs <download dir>` (needs ffmpeg)
- `trailer.mjs` (with `trailer-page.mjs` and the shot list `trailer-shots.json`) records trailer footage at Ultra with the HUD hidden, stepping the game 1/30 s per frame on Playwright's fake clock: `node scripts/trailer.mjs <url> <out-dir> scripts/trailer-shots.json [shots...]`, `STRIDE=15` for a quick look. `trailer-cards.mjs` renders the cards in `trailer-cards.html` to PNGs; `trailer-edit.mjs` cuts, overlays, and mixes the 60 s trailer with ffmpeg (see `.planning/trailer/PLAN.md`)
- `bark-lod.mjs` rebuilds a forest tree's `bark` and `lite` trunks from its Poly Haven scan (cached in the git-ignored `assets-src/.polyhaven`), keeping limbs round: `node scripts/bark-lod.mjs <polyhaven id> <glb name> <bark tris> <lite tris>`, then `node scripts/compress-assets.mjs models`. If the download of a large scan stalls, `curl -C -` it into the cache by hand
