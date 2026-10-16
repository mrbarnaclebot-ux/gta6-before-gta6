# scripts

- `setup.sh` install dependencies and Playwright's Chromium; `dev.sh` the dev server; `test.sh` everything CI runs
- `perf.mjs` frame-time measurements in fixed scenes
- `audio.mjs` (with `audio-lib.mjs`) rebuilds `public/assets/audio` from the raw Epidemic Sound downloads: `node scripts/audio.mjs <download dir>` (needs ffmpeg)
