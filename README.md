# Vice Demo (gta6-before-gta6)

A browser open-world demo set in a sunny Miami-like coastal city. Three.js, Rapier physics, plain DOM HUD.

## Commands

- `scripts/setup.sh` - install dependencies and the Playwright Chromium
- `pnpm dev` - run locally at http://localhost:5173
- `pnpm build` - type check and production build to `dist/`
- `pnpm test` - Vitest unit tests for pure logic
- `pnpm test:e2e` - Playwright end-to-end suite in headless Chromium with SwiftShader (starts its own dev server); `--grep @smoke` runs the CI subset
- `pnpm lint` / `pnpm format` - ESLint plus Prettier
- `node scripts/perf.mjs <url> <dir> [high|low] [scale]` - load time and fps probe on the GPU

Live build: https://web-production-af31.up.railway.app (Railway, redeploys on push to `phase-07-ship`).

## CI

`.github/workflows/ci.yml` runs on every push and pull request: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build`, then one Playwright test tagged `@smoke` (boot on Low, Play, walk) against `vite preview` of the build, with a 10-minute cap. Chromium is cached by Playwright version; `test-results/` (screenshots and traces) is uploaded when a step fails.

GitHub's runners have no GPU, so WebGL runs in SwiftShader at well under 1 fps. In CI that test gets one worker, one retry, and a 640x360 window. Drive, shoot, swim, and life tests run locally only (`pnpm test:e2e`).

## Performance

Measured with `node scripts/perf.mjs` on an M4 MacBook (Metal, headless Chromium, 1920x1080 at device scale 2, which renders at 1x). Averages of interleaved before/after runs; the Mac had other apps running, so single runs vary by 10 to 20 fps.

| Scene | Draw calls before | Draw calls after | High fps before | High fps after | Low fps before | Low fps after |
|---|---|---|---|---|---|---|
| Spawn (beach range) | 425 | 236 | 38.8 | 41.3 | 60.0 | 59.5 |
| Downtown | 384 | 227 | 41.1 | 42.6 | 59.3 | 59.9 |
| Beach, facing the city | 767 | 372 | 32.4 | 35.9 | 52.8 | 53.6 |
| Canal | 441 | 254 | 37.3 | 39.5 | 56.8 | 59.3 |
| Downtown at night | 438 | 260 | 36.9 | 41.3 | 57.5 | 59.6 |

Those runs overlapped a busy desktop Chrome. In the quietest back-to-back pair, High went from 50 / 46 / 36 / 44 / 52 fps to 55 / 60 / 47 / 51 / 57 in the same five scenes. The 60 fps target on High is met downtown but not yet at the beach. The game is GPU-bound, not draw-call bound (the main thread is about 65% idle). Those numbers predate the fix that actually turns N8AO's transparency mode off (the first attempt left it on); that fix alone adds about +4 fps at the beach in paired uncapped runs. Also helping: a 2048 shadow map (+2), and halving draw calls (instanced wheels, per-tree palm detail, nearby-only ferns, one streetlight batch, parked cars hidden past 150 m). The remaining big costs are N8AO (about 10 fps) and SMAA (about 6). Details: `.planning/phases/07-SUMMARY.md`.

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
