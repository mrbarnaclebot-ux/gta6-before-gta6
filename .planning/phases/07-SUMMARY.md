# Phase 7 summary: CI and performance pass

Status: built and verified on branch `phase-07-ship`. Not pushed; the orchestrator pushes. The Code Reviewer has run; its one blocker (N8AO transparency mode not actually off) and the cheap notes are fixed below. Designer sign-off and the audit pass have not run yet. The CI workflow has been validated but has not yet run on GitHub, because nothing was pushed.

## What was built

### CI (`.github/workflows/ci.yml`)

- Runs on every push and pull request, on `ubuntu-latest`, with a 20-minute job timeout. A newer run on the same ref cancels the older one.
- Setup: `pnpm/action-setup@v6` with pnpm 10.28.2 (writes lockfile v9), then `actions/setup-node@v7` with Node 22 and the pnpm cache.
- Steps, in order: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Playwright Chromium is cached under `~/.cache/ms-playwright`, keyed on the installed Playwright version (1.64.1).
  - On a cache miss: `playwright install --with-deps chromium`.
  - On a hit: only `install-deps`.
- Then `pnpm test:e2e --grep @smoke`. On failure, `test-results/` is uploaded as an artifact for 7 days.
- Validated with `npx @action-validator/cli` (exit 0). actionlint is not installed here.

### CI-aware Playwright (`playwright.config.ts`, `e2e/`)

When `CI` is set:

- `forbidOnly`, `retries: 1`, `workers: 1`, and `trace: retain-on-failure`.
- The window is 960x540, because SwiftShader's cost is per pixel and private-repo runners have 2 cores.
- The suite runs against `vite preview` of the build CI just made, not the dev server.
- `SLOW` (in `e2e/helpers.ts`) triples every test and frame-wait timeout.

Tags and scope:

- `@smoke` tags three tests: load, Play, walk, and land on the city; get into a car and drive; aim and shoot a dummy.
- The swim test and the life test (people, wanted level, death, pause, night) run locally only. They would push CI past about 15 minutes on SwiftShader.

Other changes:

- `@types/node` was added as a dev dependency so the config can read `process.env.CI`.
- The `@ts-expect-error` in `bone-map.test.ts` went away with it.

### Performance

Measured first. A draw-call probe broke each frame down per render pass: main, water mirror, shadow, and post.

At the beach (760 draw calls), 120 of the main pass's 408 calls were wheels: 15 cars, 4 wheels each, and 2 meshes per wheel. Palm cells and ferns made up most of the rest. The water mirror re-drew almost all of it.

- **Wheels** (`src/vehicle/wheel-batch.ts`):
  - Every wheel of one car kind is now two InstancedMeshes (tire and rim) for the whole city.
  - Cars keep plain pivot objects at the hubs. `scene.onBeforeRender` copies the pivots' world matrices in, after three updates matrices and before it collects draws. So the main pass, the mirror, and shadows all see this frame's wheels.
  - Review fix: the copy runs only on the first scene render of each frame (`CarModels.newFrame()` in the loop), not again for the mirror and AO renders. `CarModels` owns that scene-wide hook, as its comment says.
  - Hidden cars are skipped, and nothing is allocated per frame.
- **Palms** (`src/world/lod-instances.ts`):
  - Detail is now chosen per tree, not per 100 m cell. Within 80 m a palm uses the 7.5k-triangle model; beyond that, the 2.3k one.
  - Each 250 m chunk is one near and one far InstancedMesh.
  - The split is re-sorted only after the camera moves 4 m. This fixes the 6b gap where a palm 40 to 180 m away could draw at either detail.
  - Review fix: the re-sort copies matrices with an index loop instead of a `subarray` view per spot, so it allocates nothing.
- **Ferns:** drawn only within 140 m, using the same per-spot sorter. They are about 1 m tall, so past that range they are a few pixels.
- **Streetlights:** one instanced batch for all 800 (about 120k triangles) instead of about 25 chunk draws per pass.
- **Parked cars:** hidden beyond 150 m of the player (`DRAW_RANGE` in `driving.ts`). Their wheels hide with them.
- **N8AO transparency mode off** (`src/render/ao-pass.ts`): the biggest single GPU finding.
  - N8AO sees the transparent sea and switches on its transparency mode. That adds two extra scene renders and four whole-scene traversals every frame, and each extra render re-triggers the water's mirror pass.
  - Review fix: the first commit set `autoDetectTransparency` after the constructor had already detected the sea, so the mode stayed on and the shipped build never got the gain. The +3 fps first recorded here came from a probe toggle, not from the committed code. The pass now sets `autoDetectTransparency = false` and then `configuration.transparencyAware = false` (both typed in `n8ao.d.ts`). `ao-pass.test.ts` fails against the old code.
  - Re-measured on the shipped builds, before and after the fix: 1920x1080, High, uncapped (vsync off), M4 Metal, four interleaved pairs.
    - Beach: 46.0 / 44.9 / 42.7 / 39.1 before, 51.3 / 46.1 / 44.1 / 47.0 after. Paired gain +1.2 to +7.9, mean +4.0.
    - Canal: paired gain +0.5 to +6.3, mean +3.8. Downtown at night: +0.4 to +12.1, mean +5.3.
    - Background GPU load drifted downward across the runs, so single pairs are noisy; every pair favors the fix.
  - Screenshots show no visible change on the beach, the canal water, or at night (`07-screens/ao-transparency-canal.jpg`, before on top).
- **Shadow map 2048 on High** (was 4096), with the filter radius set to 2 texels. The world-space softness is nearly unchanged.
  - Paired gain: +1.6 to +2.5 fps.
  - Palm and player shadows look the same in a cropped before/after comparison.
- **Measured but kept** (worth more fps than they cost in looks, or no gain):
  - N8AO itself: about +10 fps if removed.
  - SMAA: about +6 if removed. The Medium preset gained nothing measurable.
  - N8AO "Low" quality: no gain, since its cost is the full-resolution passes, not the sample count.
  - Hiding pedestrians from the water mirror: within noise.
  - Removing palms entirely: +5, which is the ceiling for any further palm LOD work.
- **Minimap:** skips the clip-and-rotate redraw when position, yaw, heading, zoom, and the search area are all unchanged.
  - Review fix: the key now includes the search area's center, so a moving search area redraws, and it is written into a reused buffer instead of a new array each frame.
  - The 2440 px base canvas was kept. Profiling shows the minimap under 1% of main-thread time.
  - At 1 px/m it is already upscaled 1.5x on Retina, so halving it would blur the roads.

### 6b review leftovers

- `car-model.ts`:
  - Box fallback bodies share one unit cube, scaled per box. Swapping in the glb leaves nothing to dispose.
  - Police is passed as `kind`, not inferred from the paints length.
  - `CarVisual` carries `kind`.
- `traffic-car.ts`: wheel spin reads the radius from `CAR_SPECS[kind].wheel.radius`.
- `shooter.ts`: clicks made while a hip-fire shot waits for the gun are dropped, so one click can no longer fire two shots.
- `car-paint.ts`: light paints (value above 1.2, the white car) get `clearcoatRoughness` 0.22 instead of 0.08, against the night sparkles.

## Before and after numbers

Setup: `node scripts/perf.mjs` on the M4, Metal, headless Chromium, 1920x1080 at device scale 2 (renders at 1x). Each version is a separate `vite build --outDir` on its own `vite preview` port, and the before/after runs were interleaved. The desktop Chrome was using the GPU heavily throughout, so absolute fps dropped by up to half between rounds. Averages:

High, 3 interleaved rounds each:

| Scene | Draw calls before | Draw calls after | fps before (runs) | fps after (runs) |
|---|---|---|---|---|
| Spawn | 425 | 236 | 38.8 (50.6, 34.0, 31.7) | 41.3 (38.7, 40.2, 45.0) |
| Downtown | 384 | 227 | 41.1 (58.8, 29.9, 34.7) | 42.6 (44.3, 40.4, 43.1) |
| Beach | 767 | 372 | 32.4 (44.2, 24.0, 29.1) | 35.9 (38.2, 30.1, 39.4) |
| Canal | 441 | 254 | 37.3 (47.6, 27.8, 36.6) | 39.5 (36.8, 34.3, 47.5) |
| Downtown, night | 438 | 260 | 36.9 (42.4, 28.5, 39.9) | 41.3 (39.3, 37.8, 46.9) |

Low, 2 interleaved rounds each:

| Scene | Draw calls before | Draw calls after | fps before | fps after |
|---|---|---|---|---|
| Spawn | 387 | 206 | 60.0 | 59.5 |
| Downtown | 362 | 190 | 59.3 | 59.9 |
| Beach | 729 | 335 | 52.8 | 53.6 |
| Canal | 417 | 226 | 56.8 | 59.3 |
| Downtown, night | 387 | 215 | 57.5 | 59.6 |

- **Quietest back-to-back High pair** (spawn / downtown / beach / canal / night): before 50 / 46 / 36 / 44 / 52, after 55 / 60 / 47 / 51 / 57.
- **Targets:**
  - Beach under 450 draw calls: met (372).
  - 60 fps on High in every perf scene: met downtown only. The beach is the worst scene, at about 47 fps in the quietest run.
- **Frame breakdown at the beach, after:** main 157, mirror 137, shadow 44, post 29.

## Controls

Unchanged. A click made while a hip-fire shot is still waiting for the gun no longer queues a second shot.

## Verification

- **`pnpm install`:** adds `@types/node` 22.20.5 (dev only).
- **`pnpm lint`:** "All matched files use Prettier code style!"
  - A one-off `max-lines: 300` plus `max-lines-per-function: 40` run over every changed file passes.
- **`pnpm test`:** 18 files, 62 tests passed (after the review fixes). New:
  - `ao-pass.test.ts`: transparency mode stays off with a transparent sea added before or after the pass.
  - `lod-instances.test.ts`: per-spot near/far split, the 4 m re-sort threshold, and hiding an empty mesh.
  - `wheel-batch.test.ts`: hidden cars skipped; the right side flipped and placed.
- **`pnpm build`:** "built in 316ms".
- **`pnpm test:e2e` (full, local):** 5 passed (4.4 min). After the review fixes: 5 passed (4.2 min).
- **After the review fixes, on the GPU:** a parked car and a driven, steering car show their wheels in place; no page or console errors.
- **`CI=1` smoke subset:** run locally against `vite preview` on a spare port at 960x540. 3 passed (2.0 min, 678 s of CPU).
  - A 2-core runner should take about 6 minutes for this step, so the whole job should fit in about 10 to 12 minutes.
- **Screenshots** in `.planning/phases/07-screens/`. Each before/after image has before on top and after below:
  - `before-after-beach`, `before-after-canal`, `before-after-night`, and `before-after-palm-shadow` show no visible regression.
  - `wheels-left` and `wheels-right`: rims face out on both sides of a parked car.
  - `police-wheels`: a traffic police car.
  - `e2e-swiftshader-beach`: the CI renderer.

## Known gaps

- **60 fps on High is not reached at the beach, the canal, or spawn** on this M4 while other apps use the GPU.
  - The remaining cost is per-pixel: the main pass, the water mirror at 1024x1024, N8AO, and SMAA.
  - Next steps, in order of payoff:
    - A dynamic resolution scale on High when fps drops.
    - A half-size mirror target.
    - A third palm LOD (a further-decimated glb made locally with gltf-transform, no paid generation).
- **CI has not run on GitHub yet.** It starts on the next push. If the e2e step is too slow on the 2-core runner, the first lever is the High-quality walk test: switch it to `?quality=low` in CI.
- **Pop-in:**
  - Parked cars pop in at 150 m and ferns at 140 m. Both are a few pixels at that distance, under the haze.
  - The near/far palm swap happens per tree at 80 m.
- **Wheel batch pool:** capped at 120 wheels per car kind (30 cars), with a console warning past that. The city spawns 22 cars.
- **N8AO transparency mode is off.** If transparent glass or foliage is added later that should block AO, set `userData.treatAsOpaque` on the sea instead, and turn the mode back on.
- **Left from review, low priority:** `@types/node` is still in the project-wide `tsconfig.json` types, so browser code in `src/` type-checks Node globals. A separate tsconfig for `e2e/`, `playwright.config.ts`, and the tests would keep `src/` browser-only.
- No paid generation was used.
