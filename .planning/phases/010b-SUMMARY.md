# Phase 10b summary: vegetation and grounding

Status: built and verified on branch `phase-10b-vegetation` (from `phase-10a-terrain`). Not pushed. The Code Reviewer, Designer critique, and audit passes have not run yet.

## What was built

### One ground-placement helper (`src/land/footing.ts`)

Everything placed in the world now goes through one pure helper:

- **`stand`:** for upright things (trunks, poles, stilts, grass). Takes the lowest ground under a round footprint, then an optional sink. A tree on a slope sinks into the uphill side and never floats on the downhill one.
- **`rest` / `restOnCorners`:** for rigid footprints (cars). Fits a plane through the four corner heights and gives pitch and roll. Lowers the plane until no corner floats.
- **`upAt` + `lie`:** for rocks. They tilt with the slope's normal, and the base is lowered until the rim touches down.

Who uses it:

- **City palms, ferns, and streetlights:** grounded once in `generateLand`. Lamps no longer assume `CURB_H`.
- **Every new tree, bush, rock, and palm.**
- **Grass clumps and dune grass.**
- **Beach towers and umbrellas:** their layout moved to `land/beach-props.ts`.
- **Parked cars:** curbside spots, and six new cars on residential driveways that slope with the drive.

`instancing.ts` and `lod-instances.ts` now take grounded spots (`Grounded`: base height, an optional up vector, an optional tint) and no longer sample the ground themselves.

**Root-cause fix:** `sampleGrid` used bilinear interpolation. The terrain mesh and Rapier's heightfield both draw two triangles per cell, split along the (i+1, j) to (i, j+1) diagonal. `sampleGrid` now uses those same triangles, so `heightAt`, `surfaceAt`, house drives, and beach props all match the drawn and collided ground exactly. A Vitest confirms this against a real Rapier heightfield: 400 random rays, all within 5 mm.

**Traffic:** `TrafficCar` now rests on the road under its four corners, using Rapier raycasts (`groundProbe` in `life/traffic.ts`).

- The rays hit fixed colliders only.
- Each ray starts 1.5 m above the lane height and reaches down 4 m, so a car under a bridge never snaps up to the deck.
- This covers city streets, hills, ramps, and flyover decks.
- Pitch and roll ease toward the fitted plane. The kinematic body and the visual both use the grounded pose (`feet`).
- **Rapier quirk:** a ray that runs exactly down a heightfield grid line misses. Lanes sit on whole meters, so probe rays are nudged 1.3 mm off the grid.

### Vegetation (`src/land/flora.ts`, `src/scenery/forest.ts`, `src/scenery/grass.ts`)

- **Poisson-disk sampling:** Bridson's method on a 160 m tile that wraps, repeated over the map (`land/poisson.ts`). Density masks thin it differently everywhere, so the repeat does not show. The whole flora generates in about 0.5 s.
- **Exclusion mask (`land/clearance.ts`):** a 2 m raster.
  - **Blocked:** every road with a verge (7 m by the highway), the city, house walls and driveways, villa terraces.
  - **Yard (gardens only):** house yards.
  - **Verge strip (no trees):** the strip by the curb.
  - **Water and steep slopes:** excluded as well.
- **Biomes:**
  - **Forest and hills:** firs (13 to 24 m) with broadleaves mixed in.
  - **Open fields:** noise-driven copses of broadleaf trees.
  - **Residential:** garden trees and the odd palm in yards, and front-yard hedges on about half the houses.
  - **Avenues and coast roads:** rows of palms.
  - **Behind the beach:** scattered palms.
  - **Undergrowth:** bushes everywhere green.
  - **Rocks:** on slopes over about 20 degrees, plus a few through the woods.
  - **Hill summit:** kept as a meadow, so the lookout sees over the woods.
- **Per instance:** random height, yaw, and a slight brightness and hue tint, through instance colors.
- **Counts:**

| Kind | Count |
|---|---|
| Firs | 26,100 |
| Broadleaf | 13,100 |
| Garden trees | 140 |
| Palms (outside the city) | 340 |
| Bushes | 32,000 |
| Rocks | 2,700 |

- **Trees are Poly Haven scans** (fir_tree_01, jacaranda_tree, island_tree_01 and 02, tree_small_02), baked offline into game assets:
  - The trunk is simplified with meshoptimizer twice: `bark` (about 1 to 2.7k triangles) and `lite` (about 200 to 700).
  - The foliage, millions of triangles, is baked into a "billboard cloud". It is cut into voxels, and each voxel's real leaves are rendered (in headless Chrome) onto two or three cards in one 2048 px atlas.
  - Each tree is about 1 MB and 3 to 5k triangles.
- **Levels of detail:** full card trees within 60 m, the same cards on the lite trunk to 130 m, then a 4-triangle impostor baked at load. The impostor is drawn 30% fuller, so the far forest reads dense.
  - Only the nearest level casts shadows.
  - At ground level deep in the forest, trees past 350 m are not drawn, because trunks hide them.
  - Each 250 m chunk is one draw call per level and part.
  - A chunk whose spots all stay in one level is no longer re-sorted when the camera moves.
- **Bushes:** Poly Haven Searsia lucida, four variants, baked the same way. Drawn to 120 m.
- **Rocks:** Poly Haven rock_moss_set_01 and 02, 13 rocks simplified to 300 to 450 triangles each. They tilt with the slope.
- **Leaf cards are matte (Lambert):** under PBR, cards seen edge-on caught a pale sky sheen and read grey. Their up-leaning normals are kept on back faces (`render/card-normals.ts`); three.js flipped them, which turned half of each canopy black. Impostors, dune grass, and the city ferns get the same treatment.
- **Grass clumps:**
  - Four clumps cut from Poly Haven grass_medium_01, in one instanced mesh around the camera (42 m at render-distance reach 1).
  - Each comes from a fixed hashed 0.9 m grid, so a clump stays where it was.
  - Density follows the terrain's grass weight; there is none on dirt, roads, or sand.
  - Wind sway runs in the vertex shader, and clumps sink into the ground toward the edge of the range.
  - It is refilled every 3 m of camera travel, takes one draw call, and is not in shadows or the water's mirror.
- **Contact shading under trees:** the terrain's spare splat channel now carries canopy shade per grid vertex, from every tree crown. The forest floor reads darker under the woods, near and from the hills.
- **Colliders:**
  - Fir trunks match their trunk radius.
  - Broadleaves and garden trees are wider, so the camera stops short of their low limbs.
  - Rocks over 0.8 m have a collider.
  - Bushes and grass do not collide.

## Controls

Unchanged from Phase 10a.

## Verification

- **`pnpm build`:** passes.
- **`pnpm lint`:** passes (eslint and prettier).
  - All source files are under 300 lines, and new source functions are under 40.
  - The new `grounding.test.ts` describe block runs 92 lines, like the existing test files' describe blocks.
- **`pnpm test`:** 28 files, 102 tests pass. New: `src/land/grounding.test.ts`, which runs the real layout and placement code and checks that:
  - The ground sampler matches a real Rapier heightfield within 5 mm (400 rays).
  - Every conifer, broadleaf, garden tree, palm (city and outside), bush, city fern, and streetlight touches down: the lowest ground under its footprint is within 5 cm of its base, and none is buried deeper than its sink allowance plus 5 cm.
  - Every rock's tilted rim is within 5 cm of the ground.
  - Every beach tower and umbrella stands within 5 cm of the sand.
  - All four corners of every curbside and driveway car are within 5 cm above or 15 cm below the ground.
  - Plants stay off roads, and the flora is the same every time.
- **`pnpm test:e2e`:** 8 passed in 5.1 min.
  - `e2e/world.spec.ts` now casts a ray down from every parked car, traffic car, and visible person after settling, at the residential, hillside, and flyover landmarks.
  - It asserts that every one has ground within 10 cm, and that traffic is checked on the flyover.
  - It uses the new `window.__game.groundGaps()` helper.
- **Runtime gaps measured on Metal:**
  - Parked cars: -4 to +1.3 cm.
  - Traffic, including on the bridges: within 0.3 cm.
  - People: 0.

### Performance (`scripts/perf.mjs`, Medium, 1920x1080 at DSF2, Apple M4)

The probe gains `forest` (in the woods on the trail) and `forest-hill` (the forest from the Hillside lookout). `ONLY=a,b` limits it to the scenes named. The "before" column is the 10a build, run in the same session with the same assets.

| Scene | fps before | fps after | Draw calls before | Draw calls after |
|---|---|---|---|---|
| spawn | 60 | 59.8 | 311 | 396 |
| downtown | 60 | 60.1 | 267 | 451 |
| beach | 60.1 | 60.1 | 603 | 857 |
| canal | 60.1 | 60 | 351 | 427 |
| hillside | 60 | 60 | 395 | 789 |
| flyover | 60 | 60 | 343 | 675 |
| residential | 60 | 60.1 | 165 | 488 |
| forest | 60 | 60.1 | 90 | 422 |
| forest-hill | 59.9 | 60.1 | 100 | 470 |
| downtown-night | 60 | 60.1 | 345 | 600 |

- **Medium holds 60 everywhere,** with dynamic resolution on as always. Before the tuning, the forest scene ran at 49.
- **What got the forest to 60:**
  - The trunk LOD (`lite`).
  - Shadows from the nearest level only.
  - The 350 m cap in the woods.
  - Skipping chunks that cannot change level.
- **Uncapped** (`UNCAPPED=1`), the forest scene measured 50 to 54 before these changes and 61.6 after.
- **High** (no dynamic resolution) dropped:
  - from 37 to 60 before, to 30 to 55 after
  - the forest scene: 29.9
  - the beach: 37.4
  - High was already under 60 in some scenes in 10a's report.
- **Load and download:** play to first frames went from 2.0 s to 3.2 s, and the download from 43.6 MB to 47.1 MB. Both are within 2x.

### Screenshots (`.planning/phases/010b-screens/`)

Production build, Medium, headless Chrome on the Metal GPU, 1920x1080.

- **Day:**
  - `day-forest-from-hill`, `day-forest-from-lookout`: the forest from the hill.
  - `day-in-the-forest`: on the forest trail.
  - `day-residential-street`, `day-residential-yard`.
  - `day-beach-dunes`.
  - `day-highway`.
  - `day-avenue-grass`.
  - `day-field-copse`.
- **Dusk (17:36):** `dusk-forest-from-hill`, `dusk-in-the-forest`, `dusk-residential-street`, `dusk-beach-dunes`, `dusk-highway`.
- **Perf probe views:** `medium-dsf2-*.jpg`.

I looked at each and tuned from them:

- Leaf tone and matte cards: the canopies had been pale grey with black backs.
- Grass size, density, and color.
- Fuller impostors, so the hillsides no longer show through.
- Garden tree size and front-yard verges.
- The summit meadow.
- Canopy floor shade.
- Hedge setback.

## Known gaps

- **Impostors** are two crossed cards with baked albedo. From the hills the far forest reads as a dense conifer texture, but it is flat-lit and slightly repetitive. An octahedral impostor with normals would hold up better.
- **The fir's card foliage** looks like a fir at mid range. Up close the cards show as flat clumps of needles: it is a billboard cloud, not a branch mesh.
- **Grass** is cards, not blades, and only within about 34 m on Medium (42 m times the 0.8 reach). Beyond that the terrain texture carries the green.
- **High and Ultra** lost about 5 to 30 fps in the busiest views. Medium is the gated preset; High and Ultra were not tuned this phase.
- **Garden trees** use two Poly Haven species only. There are no flowering shrubs, and the hedges are rows of one bush model, not trimmed hedges.
- **Driveway cars** are dynamic Rapier cars like the curbside ones, six in all. Villas have none.
- **Paid tools:** no AssetHub, Higgsfield, or fal credits were spent. Every new asset is CC0 from Poly Haven, credited in `public/assets/CREDITS.md`.
- **Offline asset tools** were not committed:
  - the gltf-transform and meshoptimizer LOD script
  - the in-browser billboard-cloud baker
  - They are described in CREDITS.md.
- **Process:** the Code Reviewer, Designer critique, and audit passes are still to run.
