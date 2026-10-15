# PROJECT: Vice Demo (working title)

Status: APPROVED 2026-10-15. Owner changes: realistic graphics, free 3D assets first, Higgsfield/fal allowed if free assets fall short, host on Railway.

## What it does

A browser-based third-person open-world demo, set in a stylized sunny Miami-like coastal city (references: `ingame-examples/`), where you can walk, run, jump, swim, drive a car, and shoot.

## Problem and today

Hobby project. Friends want a playable "GTA before GTA 6" toy they can open with a link. Today: nothing playable, only screenshots.

## Who it is for / not for

- For: the owner and friends, on desktop browsers with keyboard and mouse.
- Not for: mobile or touch players, console players, anyone expecting AAA visuals, story missions, or multiplayer.

## Success criteria

- One week: open a URL, click Play, and within 10 seconds be walking around a city block with a beach and ocean. All five mechanics work: walk/run, jump, swim, drive, shoot.
- One month: steady 60 fps on a mid laptop (M1 or GTX 1060 class) at 1080p. Traffic and pedestrians. Day and night cycle. Friends play it without being told the controls.
- Done (v1): a 2 by 2 km map with downtown, beach, canal, and highway districts; a minimap; health, death, and respawn; a basic wanted level; a playwright smoke test that is green in CI.

## Out of scope for v1

Multiplayer, missions and story, character customization, save games, mobile controls, audio beyond simple SFX, motorcycles, boats, aircraft, interiors, licensed or ripped assets.

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
| Mobile | No (desktop only, shows a "use a desktop" notice) | Mouse aim and WASD | Touch controls later |
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

## Gaps found in the original idea (added above)

The ask listed movement and combat but not the systems that make them feel like a game: camera collision, HUD (health, ammo, speed, minimap), death and respawn, consequences for shooting (wanted level, fleeing NPCs), world life (traffic, pedestrians), a pause and controls screen, and mouse sensitivity. All are added to Phase 6.

## Risks and change-course triggers

- Rapier vehicle feel is poor: tune it, or fall back to arcade kinematic car physics.
- Performance under 40 fps on the target laptop: reduce draw distance, add chunked streaming.
- Free assets look too low-poly next to the realistic lighting: generate hero assets (player, car, palm) with Higgsfield/fal.
- Post-processing too heavy for mid laptops: graphics quality setting (Low/High) that drops SSAO, bloom, and shadow resolution.
- Bundle over 10 MB: lazy-load the world and assets after the title screen.
