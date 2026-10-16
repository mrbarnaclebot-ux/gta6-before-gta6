# PROJECT: GTA 6 BEFORE GTA 6 (was Vice Demo)

Status: APPROVED 2026-10-15. Owner changes: realistic graphics, free 3D assets first, Higgsfield/fal allowed if free assets fall short, host on Railway.

## What it does

A browser-based third-person open-world demo, set in a stylized sunny Miami-like coastal city (references: `ingame-examples/`), where you can walk, run, jump, swim, drive a car, and shoot.

## Problem and today

Hobby project. Friends want a playable "GTA before GTA 6" toy they can open with a link. Today: nothing playable, only screenshots.

## Who it is for / not for

- For: the owner and friends, on desktop browsers with keyboard and mouse, a gamepad, or a phone or tablet in landscape (Phase 12a).
- Not for: console players, anyone expecting AAA visuals, story missions, or multiplayer.

## Success criteria

- One week: open a URL, click Play, and within 10 seconds be walking around a city block with a beach and ocean. All five mechanics work: walk/run, jump, swim, drive, shoot.
- One month: steady 60 fps on a mid laptop (M1 or GTX 1060 class) at 1080p. Traffic and pedestrians. Day and night cycle. Friends play it without being told the controls.
- Done (v1): a 2 by 2 km map with downtown, beach, canal, and highway districts; a minimap; health, death, and respawn; a basic wanted level; a playwright smoke test that is green in CI.

## Out of scope for v1

Multiplayer, missions and story, character customization, save games, audio beyond simple SFX, motorcycles, boats, aircraft, interiors, licensed or ripped assets.

## Key decisions (default chosen, reason)

| Decision | Default | Reason | Alternatives |
|---|---|---|---|
| Language | TypeScript | Project standard | none |
| Engine | Three.js, vanilla TS, no React | A game loop does not need React. HUD is plain DOM. Smallest runtime. | React Three Fiber, Babylon.js, Godot web export |
| Physics | Rapier (`@dimforge/rapier3d-compat`) | Has a built-in character controller and raycast vehicle controller, fast WASM | cannon-es (slower, no vehicle controller as good) |
| Art | Realistic look: PBR materials (ambientCG CC0 textures), Poly Haven CC0 HDRI for sky and image-based lighting, ACES/AgX tone mapping, soft shadows, SSAO, bloom, SMAA, atmospheric fog, reflective water shader. Free CC0/MIT/CC-BY models (Poly Haven, Quaternius, Kenney, Poly Pizza, three.js examples) for character, cars, palms. Every asset listed with its license in `public/assets/CREDITS.md`. | Owner wants realistic graphics at $0 | Higgsfield/fal generated models if free ones fall short (owner approved, costs credits) |
| Build | Vite + pnpm | Project standard | none |
| Data storage | None. Settings in localStorage only. | No data collected, so no consent prompt needed. | none |
| Auth | None | Single-player, no accounts | none |
| Hosting | Railway, static build served by a tiny static server (Phase 7) | Owner choice | Cloudflare Pages |
| Offline | No | Not needed | none |
| Mobile | Yes from Phase 12a: touch controls in landscape, a rotate notice in portrait, Low with dynamic resolution by default on touch | Owner request after launch at gta6beforegta6.xyz | Desktop-only notice (v1 to Phase 11) |
| Multi-user | No | v1 scope | none |
| Cost ceiling | $0 except Railway usage and any approved AI asset credits | Owner choice | none |
| Tests | Vitest for pure logic (damage, wanted level, input mapping), Playwright smoke test that loads the game, presses keys, and screenshots | Project standard | none |
| Legal | Short Terms page linked from the title screen. No consent prompt because no data is collected. | AGENTS.md minimal legal rule | none |

## Build steps (each phase ships something clickable)

1. **Phase 1: Foundation and walking.** Vite + Three.js + Rapier scaffold, a title screen with Play (pointer lock), ground, sky, sun, a capsule character with the Rapier character controller, a third-person orbit camera with collision, WASD walk, Shift run, Space jump, and an FPS counter in dev. Decision: a capsule placeholder plus a simple procedural humanoid built from boxes; real rigged models are deferred.
2. **Phase 2: The world.** A procedural city grid (instanced buildings in a Miami palette, roads with lane markings, sidewalks), a beach strip, an ocean plane with a water shader, a canal, palm trees, and streetlights. Static colliders. Decision: a seeded generator so the map is the same every load.
3. **Phase 3: Swimming.** Water volume detection: the player floats at the surface, swims slower, Space to surface and Ctrl to dive, no jumping in water, a stamina bar while diving. Cars that enter deep water stall.
4. **Phase 4: Driving.** Rapier raycast vehicle: F to enter the nearest car and exit, W/S throttle and brake, A/D steer, Space handbrake, a chase camera, a speedometer, and parked cars around the map. Decision: one car body with a few color variants.
5. **Phase 5: Shooting.** Pistol hitscan: right mouse to aim (over-the-shoulder zoom), left mouse to fire, R to reload, ammo HUD, a muzzle flash, impact decals and sparks, damage on dummies and cars. Crosshair.
6. **Phase 6: Life and gaps.** Health, death, and respawn; simple pedestrians that wander and flee from gunfire; simple traffic on road lanes; a wanted-level star HUD; a minimap; a day and night cycle with neon at night (reference: the neon image); a pause menu with a controls list and mouse sensitivity.
7. **Phase 7: Polish and ship.** A perf pass (instancing, LOD, shadow cascades tuned), an audit and critique pass, a Playwright smoke test in CI (GitHub Actions), and a deploy to Railway (this step asks before deploying).
8. **Phase 8: Cinematic graphics and settings.** Owner request: as close to GTA 6 realism as a browser allows. Quality presets Low, Medium, High, Ultra, and Custom, applied live and saved in localStorage. Cascaded shadow maps from Medium up, tuned N8AO per preset, depth of field that follows the player and tightens when aiming, camera motion blur from depth reprojection, god rays and a subtle lens flare, a render distance setting (camera far plane, haze, plant LOD, parked cars, shadow reach) with height fog for aerial perspective, and a warm teal-orange grade (ACES plus a LUT, vignette, optional grain). A tabbed Esc settings screen (Graphics, Display, Controls) with a cost hint per row, render scale and dynamic resolution, FOV, HUD scale, show FPS, sensitivity, and invert Y. Decisions: pmndrs postprocessing for the chain; custom effects only where nothing maintained fits (motion blur, lens flare, distance blur); screen-space reflections skipped. Gate: High within about 5 fps of Phase 7 High on the M4, Medium and Low hold 60.
9. **Phase 9: Menu, loading, HUD, and map.** A main menu over the owner-generated art (`menu.webp`, `menu_night.webp`), a loading screen slideshow (`load_*.webp`) with real progress, a HUD pass toward the references, and a full-screen map. Decisions to make in its discuss step.
10. **Phase 10: A bigger, less flat world.** Owner request: the map feels flat and bland. The world grows to about 2 x 2 km (owner's choice) with the existing city kept as the core on the coast, sea to the east. Four parts, each its own branch and summary:
    - **10a Terrain and districts.** A seeded noise heightmap flattened under the city and the roads, one Rapier heightfield, distance LOD tiles, and a splat material (grass, dirt, rock on slopes, sand by the coast) from CC0 textures. Districts: a denser, taller Central downtown; Residential (west and south-west: pitched-roof houses, yards, fences, driveways, curving streets); Hillside (north-west: 60 to 90 m hills, a switchback road, villas on terraces); Forest (reserved on and beyond the hills, with a dirt trail). A divided highway linking city, residential, hills, and coast, with ramps and two flyover interchanges that traffic drives. Dunes, a wet-sand band, dune grass, and beach props. The maps draw the terrain, districts, and highway, and waypoint routes use the new roads. Gate: Medium holds 60 fps at 1920x1080 DSF2 in every perf scene; load time and download size at most double. Fixes first: the Phase 8/9 review leftovers and the 40 fps beach view.
    - **10b Vegetation and grounding.** Trees in the forest and hills, grass and shrubs, and contact shading so props and buildings sit on the ground.
    - **10c Ocean.** A better sea: waves, shoreline foam, and depth color over the new coast.
    - **10d Boats and carjacking.** Boats on the sea and canal; pulling drivers out of traffic cars.
    - **10e Sound effects and music.** Owner request, lifting the earlier "simple SFX only" limit: Epidemic Sound files from the owner's subscription, processed by `scripts/audio.mjs`; a Web Audio mixer with volume settings; footsteps, vehicles, combat, ambience by area and time, menu and chase music, and an in-car radio. Audio before Play stays under 1.5 MB.
11. **Phase 11: Optimisation, chunked world, and the new title.** Owner request. The game is renamed "GTA 6 BEFORE GTA 6" with the owner's Higgsfield logo on the menu and loading screen, and a simple favicon. Research first (`.planning/phases/11-RESEARCH.md`), measure first (`scripts/perf.mjs`: cold and warm loads, transfer, memory, frame-time percentiles, a full-map drive), then keep only what measures well. Decisions: KTX2 (Basis ETC1S) textures and Meshopt models built by `scripts/compress-assets.mjs` from sources in `assets-src`; Caddy cache headers and precompressed files through Railpack's `Caddyfile.template`; a service worker keyed by content hash for repeat visits; shader prewarm, Rapier and world generation (in a Web Worker) during the menu; small static colliders streamed in 128 m tiles with hysteresis; roads cut along the terrain tiles; far impostors on big chunks as the HLOD. Targets on the M4 at 1920x1080 DSF2: warm Play to in-game under 3 s, cold transfer under 20 MB, Medium 60 fps with p99 under 33 ms in every perf scene, no frame over 50 ms on a drive across the map, High no worse than before.

12. **Phase 12: Controls everywhere and visual realism.** Owner request after the game went live at https://gta6beforegta6.xyz. Two parts, each its own branch and summary:
    - **12a Mobile touch and gamepad controls.** One action layer that keyboard and mouse, the Gamepad API (standard mapping, hot-plug, deadzone and response curve, D-pad menus), and touch (a floating thumbstick, drag to look, context buttons of at least 48 px inside the safe area, multi-touch) all feed. Prompts, tips, and the Controls tab follow the last device used. Phones play in landscape with a rotate notice in portrait, start on Low with dynamic resolution, and the HUD moves out from under the thumbs. Menus, settings, the map (tap for a waypoint, drag and pinch), and pause all work by touch. Decisions: B is hold-to-run on foot and hold-to-dive in water; aim and run are toggles on touch; no radio buttons on touch. Tests: Vitest for the stick math and pad mapping, Playwright touch (844x390, hasTouch, isMobile) and stubbed-gamepad specs, one touch check tagged `@smoke`.
    - **12b Visual realism.** As close to the references as the browser allows, on top of Phase 8 and 10.

## Gaps found in the original idea (added above)

The ask listed movement and combat but not the systems that make them feel like a game: camera collision, HUD (health, ammo, speed, minimap), death and respawn, consequences for shooting (wanted level, fleeing NPCs), world life (traffic, pedestrians), a pause and controls screen, and mouse sensitivity. All are added to Phase 6.

## Risks and change-course triggers

- Rapier vehicle feel is poor: tune it, or fall back to arcade kinematic car physics.
- Performance under 40 fps on the target laptop: reduce draw distance, add chunked streaming.
- Free assets look too low-poly next to the realistic lighting: generate hero assets (player, car, palm) with Higgsfield/fal.
- Post-processing too heavy for mid laptops: graphics quality setting (Low/High) that drops SSAO, bloom, and shadow resolution.
- Bundle over 10 MB: lazy-load the world and assets after the title screen.
