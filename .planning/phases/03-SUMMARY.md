# Phase 3 summary: Swimming

Status: built and verified on branch `phase-03-swimming`. Code review, Designer sign-off, and the audit pass have not run yet.

## What was built

- Water volumes: `waterSurfaceAt(layout, x, z)` in `src/city/terrain.ts` returns sea level wherever the ground lies below it, and null elsewhere. That one rule covers the ocean, the shore, and the canal, and it excludes the land under the city and the beach above the waterline. The renderer, the player, and the tests all read it.
- Swimming rules (`src/player/swim.ts`, pure, unit tested):
  - The mode depends on feet depth, with hysteresis. You start swimming deeper than 1.25 m and stand up again shallower than 1.0 m, so wading at the threshold does not flicker between modes.
  - Buoyancy springs the feet back to 1.35 m below the surface, which leaves the head and shoulders out of the water. Water drag eases vertical speed, so a fall from a bridge slows down instead of stopping dead.
  - Wading slows walking smoothly, to about half speed at chest depth.
  - Breath lasts 25 s while the head is under and refills five times faster above. At zero breath you lose 10 health per second.
- Player (`src/player/player.ts`):
  - Snap-to-ground turns off while swimming and back on when you stand.
  - Swimming is slower than walking: 1.6 m/s, or 3.0 m/s with Shift.
  - Ctrl or C dives. Space surfaces faster.
  - There is no jumping in water. Instead, pressing Space at the surface tries to climb out (`src/player/ledge.ts`). A ray finds a flat top up to 2.9 m above the feet, a second ray checks that no railing or wall is in the way, and a shape test checks the capsule fits. This works on the open canal ends and on the steps.
  - Health is minimal for now: drowning to zero respawns you at the spawn with full health and breath. Real death arrives in Phase 6 and is marked with a `ponytail:` comment.
- Animation: the mannequin already had `Swim_Fwd_Loop` and `Swim_Idle_Loop` clips, so no procedural pose was needed. The stroke clip lies flat at hip height, so the avatar is lifted 0.3 m (eased) while stroking, which puts the back at the surface.
- Exiting the water:
  - The east beach slopes up gently, so you simply swim in and stand up.
  - The canal has one flight of steps per stretch between bridges, on alternating banks. A landing sits level with the bank, with a gap in the railing, and ten steps descend along the seawall to just below the surface. The steps collide as one smooth ramp that runs 2 m past the last step, because the capsule snagged on the 0.4 m treads.
- Underwater view:
  - `Sky.setUnderwater` changes the one scene fog to a dense blue-green fog (density 0.07) and uses the fog color as the backdrop. It changes the existing fog object instead of swapping in a new one, so materials keep working, and it applies the Low preset's tone-mapped fog color the same way as above water.
  - A CSS multiply overlay (`#underwater`) supplies the absorption tint. Fog alone cannot tint things a few meters away.
  - `src/world/underwater.ts` adds the surface seen from below: a back-facing sheet with a rippled alpha that drifts. three's `Water` is single-sided and invisible from below. While the camera is under, the reflective top is hidden, which also skips its reflection render.
- Boundary: the seabed now reaches 300 m out on the beach side instead of 160 m. This removes the visible seam where the depth texture ended in shallow water. Invisible walls stand at the terrain edge on all four sides, so nobody swims off the heightfield into the void.
- HUD: health and breath bars sit bottom-left and show only while not full. Each has `role="meter"` and `aria-valuenow`.
- Test hook `window.__game.state()` now reports the real `mode` (`walking` or `swimming`), `health`, `breath`, and `underwater`. `landmarks()` adds `ocean` and `canalWater`, both at the floating feet height.

## Controls

| Key | On foot | In water |
|---|---|---|
| WASD or arrows | move | swim |
| Shift | run | swim faster |
| Space | jump | surface faster. At the surface, facing a wall top or steps: climb out |
| Ctrl or C | nothing | dive |
| Mouse | orbit the camera | orbit the camera |

C exists because Ctrl+W closes the browser tab on Windows and Linux, and a page cannot block it.

## Verification

- `pnpm install`: up to date, with no new dependencies.
- `pnpm lint`: clean. Every function is under 40 lines, checked with a one-off `max-lines-per-function` run. Doing so split `buildWater` into a separate shader-patching function.
- `pnpm test`: 6 files, 27 tests passed.
  - New: 5 tests in `swim.test.ts` for the mode hysteresis, floating up from below and settling from above, diving and faster surfacing, wading, and breath drain, refill, and drowning.
  - New: 1 water-region test in `layout.test.ts`.
- `pnpm build`: passes. The game chunk is 5.3 MB (2.0 MB gzip).
- `pnpm test:e2e`: 2 passed. The new test teleports into the ocean and asserts `swimming`. It then holds Ctrl for 14 rendered frames and asserts the player sank at least 0.5 m and the camera is underwater.
- Manual runs in headless Chromium on Metal (Apple M4, 1600x900, High) hold 60 fps while swimming and diving. Underwater frames drop the reflection pass. Checked:
  - Swimming and diving.
  - Swimming in from the ocean until the player stands on the beach.
  - Swimming to the canal steps, walking up the ramp, and stepping onto the bank.
  - Drowning: at 0 breath health fell to 67 at about 28 s, then the player respawned at full health.
  - The Low preset underwater: its fog matches its backdrop.
- Screenshots in `.planning/phases/03-screens/`:
  - `swim-city.jpg`: swimming toward Ocean Drive.
  - `ocean-swim.jpg`, `canal.jpg`.
  - `stairs-approach.jpg`, `stairs-mid.jpg`, `stairs-out.jpg`.
  - `uw-a.jpg`, `uw-b.jpg`, `uw-low.jpg`: underwater.
  - `drowning.jpg`: shows the health bar.
  - `smoke-*-swiftshader.jpg`: from the e2e run.

## Known gaps

- Cars stalling in deep water (in the original Phase 3 line) waits for Phase 4, because there are no cars yet.
- The water surface has no interaction: no ripples or foam ring around a swimmer, no splash on entry, no wet-skin shading.
- No caustics on the seabed, no god rays, and no underwater particles. The underside of the surface is a uniform rippled sheet without a Snell's window.
- The camera is not split at the waterline. When it sits right at the surface, the view switches abruptly between above and below.
- Bridges sit 0.3 m above the water, so a floating swimmer is blocked and must dive under them, about 17 m on one breath. This is intentional, but nothing on screen explains it.
- The underwater check uses the camera's world position only, so a camera clipped inside the seawall below sea level would count as underwater.
- There is no fall damage or diving animation, and the tread clip has its arms out to the sides, which from behind reads close to a T-pose.
- If you teleport below the seabed (tests only), you are trapped under the one-sided heightfield.
- Offshore boundary walls are hard and invisible, 300 m out east and 160 m on the other shores.
- No paid generation was used or needed.
