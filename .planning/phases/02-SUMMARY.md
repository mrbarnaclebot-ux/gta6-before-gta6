# Phase 2 summary: The world

Status: built and verified on branch `phase-02-world`. Code review, Designer sign-off, and the audit pass from the AGENTS.md build loop have not run yet.

## What was built

- Seeded city plan (`src/city`, pure TypeScript, no three.js): `generateCity(seed, size)` returns roads, blocks, buildings, gardens, the canal, the island edge, palms, ferns, streetlights, and the spawn. Everything is derived from `size`, so `generateCity(7, 2000)` already produces a 2 by 2 km plan (covered by a unit test). The default is seed 7 at 1 km.
  - A 100 m street grid of 4-lane roads, 16 m wide, with 4 m sidewalks.
  - Districts run west to east:
    - Downtown: glass towers of 18 to 55 floors, some with setback tiers and spires.
    - Midtown: white residential mid-rises with balcony slabs.
    - Art-deco quarter: pastel low-rises with "eyebrow" sun shades and vertical fins.
    - Beachfront: deco hotels and white condo towers on Ocean Drive.
  - A 28 m north-south canal splits one block column. Every crossing street becomes a bridge.
  - Three park blocks; empty lot cells become small lawns with palms.
  - An 8 m beach promenade, then a 60 m dry beach that slopes into the sea. Sandy shores wrap the rest of the island.
  - `heightAt` / `surfaceAt` give ground height anywhere, shared by the meshes, the colliders, and prop placement.
- World (`src/world`):
  - Roads and markings:
    - Asphalt road quads use world-space UVs, so overlaps at intersections do not z-fight.
    - One draw call holds all lane lines, double-yellow center lines, zebra crosswalks, and stop lines on the arriving lanes only.
    - Raised paver sidewalks have 0.3 m concrete curbs.
  - Buildings:
    - Facades are procedural PBR. Canvas-painted albedo, roughness/metalness, and a normal map are derived from a height map, with window recesses, frames, mullions, and random blinds.
    - There are three styles, tinted per building through vertex colors.
    - Trim adds plinths, parapets, eyebrows, balconies, crowns, and rooftop cores.
    - Geometry is merged per 250 m chunk and per material for frustum culling. Every tier and rooftop core gets a box collider.
  - Sand and seabed: one mesh with wet-sand and seabed tinting by depth. Triangles buried under the city are culled, and a matching Rapier heightfield collider covers the area.
  - Water:
    - three.js `Water`: planar reflection, normal-mapped ripples, and sun glints.
    - Patched with a depth texture baked from `heightAt`. The water is turquoise and clear in the shallows, deep blue offshore, and has a foam band at the shoreline.
    - One 40 km plane covers both the sea and the canal.
    - Building and palm shadows fall on the water.
  - Canal: seawalls, bridge decks with parapets, and white railings along both banks, all with colliders.
  - Vegetation:
    - Procedural palms in four variants: a curved, ringed trunk and 14 to 18 alpha-tested canvas fronds that cast leafy shadows. They are instanced per chunk, with trunk colliders.
    - The Poly Haven fern scan (CC0) fills beds, parks, and the beach. Each of its four plants is a separate variant.
  - Streetlights: about 800 procedural cobra-head lights, about 150 triangles each, instanced, with pole colliders.
- Lighting:
  - The HDRI's lower hemisphere is repainted as sunlit ground, so walls facing away from the sun get bounce light instead of going navy.
  - Environment intensity is 0.9.
  - Fog density is 0.0016, down from 0.0038, so the skyline reads as haze instead of a wall.
  - The sun shadow camera sits 400 m up the sun ray, so 200 m towers cast complete shadows near the player.
- Test hook `window.__game` additions:
  - `landmarks()`: beach, canal, downtown, and rooftop feet positions.
  - `setCameraPitch(p)`.
  - `state()` now also returns `drawCalls` and `triangles` for the whole frame.
- Removed: the Phase 1 testbed (`testbed.ts`, `tower.ts`, `palms.ts`).

## Controls

Same as Phase 1: WASD or arrows move, Shift runs, Space jumps, and the mouse orbits the camera (pointer lock, or click-drag without it). You spawn on the Ocean Drive beach promenade facing north.

## Verification

- `pnpm lint`: clean (ESLint and Prettier). All functions are under 40 lines, checked with a one-off `max-lines-per-function` run.
- `pnpm test`: 5 files, 20 tests passed. New tests in `src/city/layout.test.ts` cover:
  - Determinism per seed.
  - City size.
  - Buildings stay inside their lots, never overlap, and never touch the canal.
  - No palm or light sits inside a building.
  - The 2 km plan grows.
  - The beach and canal heights.
- `pnpm build`: passes. The game chunk is 5.3 MB (2.0 MB gzip); there are no new dependencies.
- `pnpm test:e2e`: passes in about 40 s on SwiftShader at the High preset, running at 1 to 2 fps.
  - Walking is now measured over 12 rendered frames instead of 1 s of wall time, so it no longer flakes at 1 fps. The player moved 2.9 m.
  - The test teleports to the beach and the rooftop and asserts the player stands on the heightfield and on the roof collider, within 0.5 m.
  - It writes `test-results/smoke.png`, `beach.png`, and `city.png`.
- Manual Playwright runs on a real GPU (Apple M4, Metal, 1600x900, High) hold 60 fps, the vsync cap, at every viewpoint. Each frame is 120 to 700 draw calls and 0.75 to 2.2 M triangles, including the shadow and reflection passes.
  - Walking into the canal railing stops the player at x 35.43; the rail is at 35.85.
  - The step from the road up the curb works.
  - Walking into a downtown block stops at the obstacle.
- Screenshots in `.planning/phases/02-screens/`:
  - `ocean-drive.jpg`: the spawn.
  - `beach.jpg`, `beach-city.jpg`, `canal.jpg`, `downtown.jpg`.
  - `overview.jpg`: from the tallest beachfront roof.
  - `ocean-drive-low.jpg`: the Low preset.
  - `smoke-city-swiftshader.jpg`: from the e2e run.

## Known gaps

- Shadows cover only about 70 m around the player (one shadow map). In wide views, distant buildings have no cast shadows and look flatter. Cascaded shadows are planned for Phase 7.
- Buildings are boxes with procedural facades. There are no rounded deco corners, storefronts, awnings, signage, or neon (neon is Phase 6). All residential towers share one window pattern.
- Swimming is Phase 3. The sea and canal have colliders only on the seabed (heightfield), so the player can walk underwater today.
- The water's planar reflection renders the scene a second time. Ferns are kept out of it with a render layer. The Low preset still renders the reflection.
- Asset gaps:
  - The Quaternius palms, bushes, and lamp posts in `public/assets` are no longer used. They were replaced by procedural palms, the Poly Haven fern scan, and procedural streetlights for realism and triangle budget. They are not downloaded, but they are still in the repo.
  - `TrafficLight.glb` and `Sign_Stop.glb` are not placed yet; intersections have no signals.
- There is no highway or elevated road yet (the "highway district" is a v1 goal). The island edges are straight, and the canal is closed at both ends.
- Size: only 1 km is exercised in-game. At 2 km the terrain grid and draw calls grow about 4x, and chunk streaming does not exist yet.
- Performance is verified only on an Apple M4. It has not been measured on the M1 or GTX 1060 class target.
- No paid generation was needed for this phase. The biggest visual gap is still the mannequin character from Phase 1.
