# Phase 11 summary: optimisation, chunked world, and the GTA 6 BEFORE GTA 6 title

Status: built and verified on branch `phase-11-optimise` (from `phase-10e-audio`). Not pushed, not deployed. Code Reviewer and Designer passes have not run yet.

Research: `.planning/phases/11-RESEARCH.md`. The before/after tables are in `README.md` (Performance) and below.

## What was built

### Part 1: the new name and logo

- Every user-facing name is now "GTA 6 BEFORE GTA 6": page title and description/Open Graph meta, the menu, the loading screen, `terms.html`, `README.md`, `.planning/PROJECT.md`, the in-game credits, and `package.json` (`gta6-before-gta6`). No e2e test asserted the old name.
- Kept on purpose: the `vice.*` localStorage keys (renaming them would reset everyone's saved settings) and a temp-dir prefix in `scripts/audio-lib.mjs`. Neither is seen by players.
- The owner's Higgsfield logo (`public/assets/ui/logo.webp`, 1113x590, 155 KB) replaces the text wordmark. It sits inside the `h1`, with the name as `alt`, so screen readers still read the title. It is preloaded. Its width is capped by the menu column, by the viewport width, and by the viewport height, so the five menu items always fit below it. On portrait screens it is capped at 34vh. It was checked at 1920, 1280, 820 and 390 px wide (screens below). The loading screen shows the same file at 120 to 210 px wide, top left.
- Favicon: a hand-drawn SVG "6" in the logo's pink, orange and cyan, on a dark tile with a sunset disc. It reads clearly at 16 px. The full logo would not. `apple-touch-icon.png` (180 px) is made from `logo_icon.png`. Credits are in `public/assets/CREDITS.md` (owner-generated with Higgsfield).

### Part 3: measuring first (`scripts/perf.mjs`, `scripts/perf-lib.mjs`)

- **Cold visit:** title visible (the logo decoded), Play to first frame, Play to fully streamed (network quiet, car bodies in, no collider tiles queued), and bytes transferred. The service worker's own fetches never reach the page's network log, so the cold visit runs with workers blocked.
- **Warm visit:** a second profile that visits twice. The second visit is timed.
- **Every scene:** JS heap and renderer memory (geometries, textures), avg fps, p95 and p99 frame time, frames over 50 and 100 ms, draw calls, and main-thread work per frame (`cpuMs`, read from a counter in the game loop).
- **New drive scene:** the whole highway loop (about 3.4 km through city, residential, hills, forest edge and coast) at 40 m/s, with the camera looking ahead.
- The baseline table was recorded before anything changed. Hooks were added for it: `state().geometries/textures/cpu`, `lane(name, side)`.
- **Scratch tools (not committed):** a CPU profiler with inclusive and caller views, a draw-call breakdown by object, a per-feature cost probe, and fixed-time A/B screenshots. Several findings below come from these.

### Part 4: what changed, in order of effect

1. **Rapier's per-step remap (the biggest win; not on the leftover list).** In 0.21, `World.step()` ends with `mapNewSoftBodies()`. That walks every collider handle through a JS callback and checks every mapped collider. With about 40k static colliders, it was 15 to 40 ms of main thread per frame. `world.mapNewSoftBodies = () => {}` (marked `ponytail:` in `src/physics.ts`) turned this off. The game has no soft bodies, and creating or removing colliders keeps the JS maps right on its own. Main-thread work fell to 3 to 6 ms a frame.
2. **Loading, CPU side:**
   - The land plan, flora, sea field and terrain splat (about 1.2 s of pure work) are now built in a module Web Worker that starts when the menu has painted (`src/land/plan-worker.ts`, `make-plan.ts`, `world-plan.ts`). A main-thread fallback covers the worker failing.
   - Rapier's WASM starts compiling on the menu too.
   - `renderer.compileAsync(scene, camera)` compiles every material, hidden LODs included, behind the loading screen.
   - `checkShaderErrors` is off in production builds.
3. **Loading, bytes (`scripts/compress-assets.mjs`, sources moved to `assets-src/`):**
   - **PBR sets:** all became KTX2, Basis ETC1S quality 200, mipmapped, flipped to match the old JPEG uploads. The terrain's four layers are now two KTX2 2D-array textures. Textures went from 20.6 to 6.1 MB, with no JPEG decode and a quarter of the VRAM.
   - **Models:** every glb is Meshopt-compressed (quantized). `src/world/load-model.ts` widens the attributes back to floats, because the game merges and transforms model geometry on the CPU.
   - **Model textures:** JPEG textures inside models became WebP, and plant textures are capped at 1024 px. The four bushes (which share three textures) are now one file.
   - **HDRIs:** only the sky half ships (the ground half was always painted over), and the night sky loads from 15:00. Sky files went from 7.2 to 1.9 MB.
   - **Quality checks:** fixed-time A/B screenshots of downtown, beach, car, residential, hillside, forest, marina and Ultra AO. Only one change is visible: the nearest leaf card in the forest looks slightly softer.
4. **Caching:**
   - `Caddyfile.template` replaces Railpack's default Caddyfile. It keeps everything the default had and adds `immutable` for `/build/*` (Vite's hashed output, moved from `/assets`) and `no-cache` (ETag revalidation) for everything else.
   - `file_server precompressed br gzip` serves the `.br`/`.gz` files the build writes (`scripts/build-assets.ts`). glb and hdr files are now compressed; Caddy's default list skipped them.
   - A service worker (`src/sw/`, production only) serves `/assets` and `/build` from Cache Storage, keyed by path plus content hash from `asset-manifest.json`. It re-reads the manifest on every page load, deletes entries the manifest no longer lists, and never caches range requests (the music streams).
5. **Chunked world:**
   - Small static colliders (trunks, rocks, palms, lamp posts, buildings, houses, lifeguard towers) now register with `StaticColliders` (`src/world/static-colliders.ts`) instead of being created at load.
   - They live in 128 m tiles that load within 180 m of the player or camera and unload past 260 m. The ring math is pure and unit-tested in `rings.ts`.
   - Tiles within 48 m build at once, so nothing is missing under you after a teleport. Farther tiles build at 400 colliders a frame. Big colliders (terrain heightfield, roads, sea walls, highway trimesh) stay global.
   - About 1,200 colliders are live at the spawn, against about 40k before.
6. **Draw calls:**
   - Far tree and palm impostors now go on 800 m chunks (`farChunk` in `lod-instances.ts`). This answers leftover (i): the marina was drawing about 280 impostor meshes per pass, in the view and again in the sea mirror, not pier props. The boat and piles were already merged.
   - Outer roads, paint and bridges are cut along the 256 m terrain tiles (`splitByTile`, `addTiled`), so off-screen tiles are culled (leftover vi).
   - The marina on High went from 1135 to 792 draw calls.
7. **Mid-distance trees (leftover iii):** the MID level now draws every other leaf card, each grown 1.35 times about its centre (`thin-cards.ts`). The impostor is still baked from the full set of cards. This gave +1 to 2 fps uncapped on High in the forest and residential views.
8. **Ultra (leftover ii):** a per-feature probe on the hillside showed N8AO at full resolution cost about 18 ms of a 44 ms frame. Ultra AO now runs at half resolution with the most samples (it looks the same in A/B screenshots). Ultra hillside went from 22.8 to 32 fps uncapped.
9. **Allocations and fish (leftover v):** the wave query reuses scratch arrays and one sea sample instead of creating 12 objects per call. Awake fish schools are packed at the front of the instanced mesh, and `count` stops there.
10. **Matrices:** the scene's matrix update ran once per scene render (the view, the mirror, AO). Now `matrixWorldAutoUpdate` is off and it runs once a frame.

## Before and after (M4, 1920x1080 at DSF2)

Loading, Medium, median of three interleaved runs:

| | Before | After | Target |
|---|---|---|---|
| Play to first frame, cold | 3.39 s | 2.20 s | |
| Play to fully streamed, cold | 3.46 s | 2.30 s | |
| Play to first frame, warm | 3.21 s | 2.40 s | under 3 s: met |
| Transferred, cold | 55.2 MB | 22.6 MB | under 20 MB: missed by 2.6 MB |
| Transferred, warm | 46.6 MB | 0 MB | |
| JS heap after the scenes | 294 MB | 308 MB | |
| Geometries / textures after the scenes | 647 / 208 | 718 / 198 | |

Frame rates: see the Medium and High tables in `README.md`.

- **High:** better in every scene. p99 is at or under 33.4 ms in 10 of 13 scenes (beach, residential and forest sit at 50), against 0 of 13 before. Frames over 50 ms on the drive went from 226 to 1.
- **Medium, final run:** p99 is at or under 33.4 ms in every scene. The marina went from 33.6 to 59.6 fps. Beach (50.2), forest (52.4), hillside (56.8) and flyover (57) stayed under 60 in that run, though quieter runs earlier hit 60 in all of them.
- **The drive:** frames over 50 ms were 0, 0 and 3 across three runs after (the worst was 83 ms), against 0 to 114 before.

## Measured and not done (they did not earn their place)

- **Occlusion culling:** downtown on High, cutting render distance from far to near gained only 2 fps (84.5 to 86.4 uncapped). Hidden far geometry is not where the frame goes; AO, shadows and fill are.
- **Static shadow caching:** shadows high to low is worth about 6 fps downtown. A cached static pass would only win back part of that, and with cascaded maps under a moving sun it needs a re-bake path. Left for later.
- **AI and physics LOD:** there are 24 people and 10 traffic cars, and the whole simulation step (physics, life, combat, camera) is about 1.3 ms a frame. Rapier already sleeps idle bodies.
- **Splitting roads by tile:** neutral on fps (the flyover sees many tiles at once, so draw calls there went up) but kept as asked, so roads behind the camera no longer draw.
- **Warm visit, service worker against the HTTP cache:** locally both took about 2.2 to 3.1 s with the same CPU-bound start. The service worker matters over a real network, where 189 revalidations cost round trips.

## Controls

Unchanged. WASD move, Shift run, Space jump, F car or boat, right mouse aim, left mouse fire, R reload, M map, Q/E radio, Esc pause.

## Known gaps

- **Cold transfer is 22.6 MB, against a 20 MB target.**
  - Breakdown: models 8.4, textures 6.1, audio 3.6 (the 1.7 MB menu theme streams while the loading screen is up), HDRI 1.9, JS 1.8, UI 0.7.
  - Getting under 20 MB needs one of these: a lower-bitrate menu theme, 1k car textures, or offline-baked impostors so the forest models can load only near the forest.
- **The warm visit is not faster than the cold one locally.** The start is CPU-bound, and the service worker adds a little start-up. 0 bytes are transferred on the warm visit.
- **Visual meshes are resident for the whole map, not unloaded by ring.** They are culled by chunk and use the existing LODs and impostors as the HLOD. GPU memory was not a limit, and building the far half after the first frame would need a second shader prewarm. Colliders are the part that streams.
- **Shader programs are re-checked every frame for materials drawn in both the view and the sea mirror.** Three keeps a light-state version per render state, so the two never match. It costs about 1 ms of CPU per frame downtown, and fixing it needs a change to how the mirror renders.
- **Soft bodies:** the Rapier patch must go if soft bodies are ever used.
- **Plant textures at 1024 px:** the nearest leaf cards are a touch softer than at 2048.
- **Paid tools:** no AssetHub, Higgsfield or fal credits were spent. The logo is the owner's existing generation. Tools installed with Homebrew to build and test assets: `caddy`, `basis_universal`, `webp`.

## Screenshots (`.planning/phases/011-screens/`)

- `menu-1920.jpg`, `menu-1280.jpg`, `menu-820.jpg`, `menu-390.jpg`: the logo on the main menu at four widths.
- `loading.jpg`: the loading screen with the small logo.
- `hlod-hillside.jpg`: a long view from the Hillside meadow, High. Full trees nearby, thinned mid trees, the impostor forest on the far hills, and the city beyond.
- `long-rooftop.jpg`: across the city from the tallest beachfront roof, High.

## Test results

- `pnpm install --frozen-lockfile`: up to date.
- `pnpm build`: passes (the plan worker is 29 kB; the service worker is `dist/sw.js`).
- `pnpm lint`: clean.
- `pnpm test`: 44 files, 158 tests passed. New tests cover the ring and hysteresis math, the cache plan, the split by tile, and the Basis transcoder staying in step with three.
- `pnpm test:e2e`: 11 passed (10.7 min). The new `streaming.spec.ts` drives across collider tiles and teleports 2 km into the forest, then checks the colliders and ground under the player. The drive test's timeout went from 180 to 300 s: it passes in about 1 minute alone, but in the full parallel run it took just over 3 minutes.
