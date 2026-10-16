# GTA 6 BEFORE GTA 6 (gta6-before-gta6)

A browser open-world demo set in a sunny Miami-like coastal city. Three.js, Rapier physics, plain DOM HUD.

## Commands

- `scripts/setup.sh` - install dependencies and the Playwright Chromium
- `pnpm dev` - run locally at http://localhost:5173
- `pnpm build` - type check and production build to `dist/`
- `pnpm test` - Vitest unit tests for pure logic
- `pnpm test:e2e` - Playwright end-to-end suite in headless Chromium with SwiftShader (starts its own dev server); `--grep @smoke` runs the CI subset
- `pnpm lint` / `pnpm format` - ESLint plus Prettier
- `node scripts/perf.mjs <url> <dir> [quality] [scale]` - cold and warm load, transfer, memory, and frame-time probe on the GPU (see `scripts/README.md`)
- `node scripts/compress-assets.mjs` - rebuilds the KTX2 textures, Meshopt models, and sky-half HDRIs in `public/assets` from `assets-src` (needs `basisu`, `ffmpeg`, `cwebp`)

Live build: https://web-production-af31.up.railway.app (Railway via Railpack, which serves `dist` with Caddy using `Caddyfile.template`: cache headers and precompressed files).

## CI

`.github/workflows/ci.yml` runs on every push and pull request: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build`, then one Playwright test tagged `@smoke` (boot on Low, Play, walk) against `vite preview` of the build, with a 10-minute cap. Chromium is cached by Playwright version; `test-results/` (screenshots and traces) is uploaded when a step fails.

GitHub's runners have no GPU, so WebGL runs in SwiftShader at well under 1 fps. In CI that test gets one worker, one retry, and a 640x360 window. Drive, shoot, swim, and life tests run locally only (`pnpm test:e2e`).

## Performance

Measured with `node scripts/perf.mjs <url> <dir> <quality> 2` on an M4 MacBook (Metal, headless Chromium, 1920x1080 at device scale 2, which renders at 1x), against the production build served by Caddy with the deploy config (`Caddyfile.template`; the "before" build with Railpack's default one). Before is the Phase 10e build, after is Phase 11. Before and after ran back to back; the Mac had other apps open, so single numbers move by 5 to 10 fps. Frame times come from requestAnimationFrame; "draw calls" count every pass (view, sea mirror, shadows, post).

Loading (Medium, median of three interleaved runs; "warm" is a second visit in the same browser profile):

| | Before | After |
|---|---|---|
| Play to first frame, cold | 3.39 s | 2.20 s |
| Play to everything around the spawn streamed, cold | 3.46 s | 2.30 s |
| Play to first frame, warm | 3.21 s | 2.40 s |
| Transferred, cold (to fully streamed) | 55.2 MB | 22.6 MB |
| Transferred, warm | 46.6 MB | 0 MB |
| JS heap after the scenes | 294 MB | 308 MB |

Medium:

| Scene | fps before | fps after | p99 ms before | p99 ms after | frames > 50 ms before | after | draw calls before | after |
|---|---|---|---|---|---|---|---|---|
| spawn | 52.2 | 60 | 66.6 | 16.8 | 3 | 0 | 549 | 430 |
| downtown | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 457 | 360 |
| beach | 51.6 | 50.2 | 33.4 | 33.4 | 0 | 0 | 907 | 675 |
| shore | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 227 | 255 |
| canal | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 422 | 367 |
| marina | 33.6 | 59.6 | 50.1 | 16.8 | 2 | 0 | 837 | 701 |
| hillside | 51 | 56.8 | 50 | 33.4 | 0 | 0 | 714 | 658 |
| flyover | 60 | 57 | 16.8 | 33.4 | 0 | 0 | 637 | 571 |
| residential | 59.6 | 60 | 16.8 | 16.8 | 0 | 0 | 555 | 425 |
| forest | 49.8 | 52.4 | 33.4 | 33.4 | 0 | 2 | 523 | 382 |
| forest-hill | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 424 | 369 |
| underwater | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 104 | 133 |
| downtown-night | 60 | 59.8 | 16.8 | 16.8 | 0 | 0 | 495 | 486 |
| drive: the highway loop at 40 m/s, 86 s | 59.3 | 58.8 | 33.3 | 33.3 | 0 | 3 | | |

High:

| Scene | fps before | fps after | p99 ms before | p99 ms after | frames > 50 ms before | after | draw calls before | after |
|---|---|---|---|---|---|---|---|---|
| spawn | 14.2 | 37.5 | 116.8 | 33.4 | 46 | 0 | 497 | 504 |
| downtown | 19.4 | 41.5 | 116.7 | 33.4 | 38 | 0 | 457 | 419 |
| beach | 21.1 | 32.1 | 116.7 | 49.9 | 37 | 0 | 1166 | 770 |
| shore | 23.4 | 52 | 116.6 | 33.4 | 27 | 0 | 278 | 273 |
| canal | 24.1 | 39.7 | 116.7 | 33.4 | 20 | 0 | 431 | 357 |
| marina | 21.5 | 42.1 | 116.5 | 33.4 | 30 | 0 | 1185 | 792 |
| hillside | 27 | 36.7 | 83.4 | 33.4 | 21 | 0 | 851 | 845 |
| flyover | 28.9 | 41.5 | 83.3 | 33.4 | 12 | 0 | 666 | 536 |
| residential | 21.6 | 33 | 116.6 | 50 | 26 | 0 | 533 | 412 |
| forest | 25.2 | 30.2 | 50.1 | 50.1 | 7 | 4 | 429 | 390 |
| forest-hill | 25.4 | 44.5 | 83.4 | 33.4 | 32 | 0 | 460 | 364 |
| underwater | 43.8 | 57.4 | 50 | 33.4 | 0 | 0 | 105 | 127 |
| downtown-night | 25.6 | 48.9 | 100 | 33.4 | 21 | 0 | 555 | 501 |
| drive: the highway loop at 40 m/s, 86 s | 29.9 | 47 | 100 | 33.4 | 226 | 1 | | |

Phase 12b (visual realism) numbers, before and after, are in `.planning/phases/012b-SUMMARY.md`: Medium still holds 60 in every scene.

Ultra on the hillside: 17.6 to 23 fps (uncapped 22.8 to 32). The biggest single win was in Rapier, not the renderer: its `step()` re-mapped every one of about 40k colliders through JavaScript each physics step. Details, and what was tried and dropped: `.planning/phases/011-SUMMARY.md`.

## Controls

WASD move, Shift run, Space jump, mouse look (click the view to lock the mouse, or drag), Esc releases the mouse. The top-right button switches Graphics High/Low; `?quality=low` in the URL forces Low.

## Layout

- `src/input` keyboard and mouse, key bindings
- `src/player` character controller, movement math, animated avatar
- `src/camera` third-person orbit camera with collision
- `src/render` renderer, post-processing, HDRI sky and sun
- `src/world` PBR materials, static colliders, Phase 1 test block
- `src/ui` HUD
- `public/assets` free-licensed models, textures, HDRIs (see `CREDITS.md`)

Spec: `.planning/PROJECT.md`. Phase notes: `.planning/phases/`.
