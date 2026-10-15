# Phase 1 summary: Foundation and walking

Status: built and verified on branch `phase-01-foundation`. Code review, Designer sign-off, and the audit pass from the AGENTS.md build loop have not run yet.

## What was built

- Scaffold: Vite 8, TypeScript 6 (pinned below 7 because typescript-eslint does not support 7 yet), pnpm scripts `dev`, `build`, `test`, `test:e2e`, `lint`, `format`, ESLint (flat config with typescript-eslint) plus Prettier, `scripts/setup.sh`, `scripts/dev.sh`, `scripts/test.sh`, `.gitignore`, `.env.example`.
- Title screen with Play, a controls line, and a Terms link (`public/terms.html`). No data is collected, so there is no consent prompt. The game bundle (three, Rapier, post) loads lazily after Play is clicked.
- Rendering (`src/render`): sRGB output and ACES filmic tone mapping. The Poly Haven HDRI is both the sky and the image-based lighting. The sun direction is read from the brightest pixel of the HDRI, so shadows match the sun painted in the sky. Fog color comes from the HDRI's horizon band (FogExp2 haze). The directional sun casts soft PCF shadows from a frustum that follows the player and snaps to texels.
  - High: HalfFloat composer with N8AO ambient occlusion, mipmap bloom, ACES, a light vignette, and SMAA. 4096 shadow map, pixel ratio up to 1.5.
  - Low: direct render, no post, 1024 shadow map, pixel ratio 1.
  - The toggle sits in the top-right HUD button, is saved in localStorage, and can be forced with `?quality=low|high`.
- World (`src/world`, a Phase 1 test block that Phase 2 replaces): a PBR grass ground, a paver plaza, and asphalt roads, all with metric UVs. A palm boulevard uses the Quaternius palms, normalized and de-metallized. Nine art-deco towers in Miami pastels have stucco ribbon spandrels, corner piers, stepped crowns, and reflective glass cores. The block also has test fixtures: stairs with 0.2 m risers, a walkable 20 degree ramp, a too-steep 50 degree ramp, and a wall for camera collision.
- Player (`src/player`): a Rapier kinematic character controller with a capsule (1.8 m), autostep 0.45 m, snap-to-ground, a 45 degree climb limit, gravity, jump with coyote time, eased acceleration, and smooth turning. The UAL mannequin (CC0) is recolored to clay and graphite, with Idle, Walk, Sprint, Jump_Start, and Jump_Loop clips crossfaded through an AnimationMixer. If the model fails to load, a capsule mesh takes its place. Physics runs at a fixed 60 Hz and rendering interpolates between steps.
- Camera (`src/camera`): a third-person orbit. The mouse orbits when the pointer is locked, and click-drag orbits when it is not, so the game works without pointer lock. A sphere is cast from the head pivot so walls never clip the view: the camera snaps in at once and eases back out.
- HUD: FPS counter (dev builds or `?debug`), quality toggle.
- `window.__game`: `state()` returns position, mode, grounded, health, ammo, fps, frames, quality, pointerLocked, and camera. Helpers: `setQuality`, `teleport`, `setCameraYaw`.

## Controls

WASD or arrow keys move, Shift runs, Space jumps. Mouse look works after clicking the view (pointer lock) or by click-drag. Esc releases the mouse. The top-right button switches graphics between High and Low.

## Verification

- `pnpm lint`: clean. `pnpm test`: 4 files, 14 tests passed (input mapping, orbit and camera math, movement and jump logic, HDRI sun and horizon analysis). `pnpm build`: passes.
- `pnpm test:e2e`: the smoke test passes on SwiftShader at the High preset. It loads the page, clicks Play, holds W for 1 s, and the player moved 0.78 m (the run was at about 4 fps). It writes `test-results/smoke.png`.
- Manual Playwright checks on a real GPU (Metal, 60 fps at 1280x720, High):
  - Jump peaks near 1 m.
  - The stairs climb to the 1.22 m terrace.
  - The 20 degree ramp climbs to 2.4 m.
  - The 50 degree ramp blocks (y stays 0.02).
  - The camera stops at 16.55 in front of the wall face at 16.8.
- Screenshots: `.planning/phases/01-screens/` (game-high.jpg, game-low.jpg, title.jpg, camera-collision.jpg).

## Known gaps

- The character is a neutral mannequin, not a photoreal person. No CC0 photoreal rigged human with a full clip set was found. This is the first candidate for paid generation, which needs owner approval.
- The palms are low-poly and stylized next to PBR materials, the same asset limit. The ground has no tiling breakup.
- A single shadow frustum of plus or minus 70 m covers the area around the player, so distant towers cast no shadows. Cascaded shadows are planned for Phase 7.
- Walk and sprint playback speeds are estimates, so slight foot sliding is possible.
- Esc does not pause the game; the pause menu is planned for Phase 6. Mouse sensitivity is fixed.
- The game bundle is about 5.3 MB minified (about 2 MB gzip), mostly Rapier's inlined WASM. It is lazy-loaded after Play.
- There is no CI workflow yet; it is planned for Phase 7.
- Rapier sinks the character a few centimeters into very large cuboids (f32 precision), so the ground collider is built from 100 m tiles. Phase 2 colliders should stay under about 100 m per box.
