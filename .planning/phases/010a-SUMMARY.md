# Phase 10a summary: terrain and districts (2 x 2 km world)

Status: built and verified on branch `phase-10a-terrain` (from `phase-09-ui`). Not pushed. The Code Reviewer, Designer critique, and audit passes have not run yet.

## Review leftovers fixed first (Phase 8/9)

- **(a) Pointer lock after Esc:** closing the map (or the pause menu) with Esc cannot re-capture the mouse, because Esc is not a user gesture. A "Click to look around" pill now shows in the middle of the screen until a click takes the mouse back. It only shows in browsers that granted the lock before, so headless runs never see it.
- **(b) Map labels:** district names are drawn after the route line, so the line never cuts through them.
- **(c) Asset folders:** `public/assets/ui/README.md` and `public/assets/textures/README.md`.
- **(d) Settings tab:** the in-game Esc menu now always opens on Graphics, whatever tab was used on the title screen.
- **(e) Menu focus:** focus follows the pointer only after a real `pointermove`. `mouseenter` also fired when the menu appeared under a still cursor, which stole keyboard focus (the suspected menu e2e flake).
- **(f) CSM rebuilds:** already fixed in Phase 8 (`Look.apply` only reconfigures shadows when the shadow tier or reach changes). No change.
- **(g) Settings at 390 px:** rows stack (control under its label) under 600 px; segmented groups wrap. Checked at 390x844: page and dialog are 390 and 356 px wide, no overflow (`010a-screens/settings-phone.jpg`).
- **(h) The 40 fps beach.** Profiled the Medium beach view (looking from the sand at the city):
  - Far palms were most of its 6 M triangles. A third level of detail was added: past 220 m a palm is a 4-triangle impostor (two crossed cards baked from the far model at load, `world/impostor.ts`).
  - The water mirror redrew the whole city every frame because the 40 km sea plane is always "in view", even looking inland. It now renders only when a box around some water is in the camera frustum (`world/wet-areas.ts`).
  - People and traffic (30k+ triangles each) cast shadows only within 40 m.
  - Dynamic resolution now aims at a full 60: it drops below 58 fps instead of 55, and each drop right after a climb doubles the hold before the next climb, so it settles instead of hunting.
  - Result before the new world: all five Medium scenes at 60.

## What was built

### The world (`src/land`, pure data)

- **Size:** the terrain covers 2.86 x 2.31 km (land about 2.1 x 2.3 km). The 1 km city stays as the core on the coast; the sea stays east.
- **Heightmap:** seeded multi-octave gradient noise. Rolling fields; three hills (the Hillside hill peaks at about 92 m); a ridge rising to 110 to 150 m along the west, north, and south edges that fades out toward the beach. It is flat under the city and eases from 0.1 m at the city edge to the natural ground over 240 m. Baked once at load into a 4 m grid (716 x 578 vertices, about 0.5 s).
- **Cut and fill:** every road and building pad is stamped into the grid: flat across the road plus a shoulder, then blended back to the natural ground over a band that widens with the height difference. Overlaps go to the stronger stamp, and ties go to the nearer centerline. Only the highway may leave the ground: above 2.5 m the fill tapers out and the road stands on piers.
- **Road profiles:** each road's height is the smoothed ground along it, pinned to the roads it joins, and grade-limited (highway and ramps 6%, the switchbacks 8.5%, streets 8%).
- **Central:** the existing downtown is denser and taller: lots of 30 m instead of 36, 4% empty instead of 10%, 78% glass towers of 22 to 72 floors (up to about 270 m).
- **Residential** (west and south-west):
  - Palm Avenue runs west from the city, under the highway, and sways gently.
  - Four curving side streets run north and south off it, each ending in a cul-de-sac.
  - 150 houses face the streets, each on a level pad with a front yard. They have:
    - one or two storeys, stucco walls in Florida pastels
    - a gabled roof with a procedural tile texture
    - framed windows, a door, and a garage door
    - a concrete driveway draped on the ground
    - a fenced back yard
- **Hillside** (north-west):
  - Hill Road leaves the city westward.
  - Hillside Drive climbs the hill in five arcs joined by four hairpins on the face toward the skyline.
  - It ends at a level lookout on the summit.
  - 15 modern villas stand on terraces on the downhill side of the arcs. Each has a cantilevered upper floor, glass across the view side, a pool, and a stone retaining wall.
- **Forest:** a reserved area on and beyond the hills along the west and north edges, with a dirt floor tint, a dirt trail (dashed on the map) from the lookout over the forest hill to the westmost residential cul-de-sac, and map labels. No trees yet: planting is Phase 10b. No placeholder trees were added.
- **Highway** (`land/highway.ts`):
  - A divided four-lane road, 22 m wide, shaped like a U opening to the sea. It leaves the north beach, runs west past the city, south along the city's west side, and back east to the south beach.
  - A turnaround roundabout at each beach end, with a coast road from the city's beach road.
  - Two diamond interchanges where it crosses Hill Road and Palm Avenue:
    - The main line climbs 6.4 m onto a bridge deck at no more than 6% (cosine-eased ramps).
    - It runs on piers over the crossing road, with parapets.
    - Four ramps per interchange leave and rejoin at grade.
  - A Jersey barrier runs down the median.
  - Deck surfaces, parapets, piers, the barrier, and every highway and ramp surface are Rapier triangle-mesh colliders. Cars drive over the decks and under them; checked by driving a car over the Hill Road bridge (it holds the deck at 9 m).
- **Beach:**
  - Dunes and berms are noise on the sand, from 3 to 46 m out, sloping smoothly to the waterline at about 60 m.
  - A darker wet band at the waterline (in the ground shader).
  - Sea-oat dune grass on the crests.
  - Every 160 m the length of the coast: a pastel lifeguard tower on stilts, and clusters of striped umbrellas with loungers between them.

### Rendering (`src/scenery`)

- **Terrain tiles:** 256 m tiles, each a `THREE.LOD` with four levels (4, 8, 16, and 32 m cells, switching at 340, 720, and 1400 m) and skirts to hide cracks. Triangles hidden under the city slabs are dropped. Tiles flatter than 6 m cast no shadows.
- **Physics:** one Rapier heightfield over the whole grid, plus invisible walls at its edge.
- **Splat material:** grass (Poly Haven rocky_terrain_02), dirt (forest_ground_04), rock on slopes over about 30 degrees (aerial_rocks_02), and sand (coast_sand_01).
  - All CC0, 1k. They are packed into two texture arrays: color with roughness in alpha, and normals.
  - Each layer is sampled at two scales to hide tiling.
  - Layers with no weight are skipped, using explicit gradients.
  - Large-scale lusher and drier grass patches; a wet sand band; blue-green seabed.
- **Roads:** asphalt, lane paint, and concrete are each one merged mesh for the whole map. The highway has a yellow inner edge, dashed lane lines, and white outer lines; the avenues have a double yellow center.
- **Haze:** fog density per render distance thinned by about 20% for the larger map (Medium 0.002 to 0.0016), so the skyline reads from the hills.

### Maps

- **Base map:** now covers the whole terrain grid. It has:
  - hill-shaded terrain colored by ground cover (grass, forest, rock, dirt, sand, sea depth) with 20 m contours
  - a smooth vector beach band
  - the city as before
  - every outer road cased, the highway and ramps in amber, the trail dashed
  - houses and villas
- **Labels:** Central (was Downtown), Midtown, Deco District, Beachfront, Residential, Hillside, Forest.
- **Legend:** gains Highway and Home. The map title is now "Map".
- **GPS:** routes over every road with A* by travel time (`land/road-graph.ts`, `land/route-search.ts`). The graph has 3,205 vertices and is fully connected; a route plans in about 3 ms. Ramps are treated as two-way (ponytail).

### Traffic

- The same pool of ten cars now spawns on the city grid or the highway, whichever lands in range of the player.
- Highway cars follow a directed lane graph (`land/lane-graph.ts`): the outer lane each way, the off-ramps, a straight-across or under-the-bridge link at each crossing, the on-ramps, and the beach turnarounds. They climb the bridges with height and pitch.
- Obstacles more than 3 m apart in height are ignored, so a car on a bridge never brakes for the road beneath.

### Landmarks and test hook

- New landmarks: `residential`, `hillside` (the lookout), `forest` (on the trail), and `flyover` (the outbound lane on top of the Hill Road bridge). Existing ones (spawn, beach, canal, downtown, ocean, rooftop, car, range) still work.
- `window.__game.ground(x, z)` returns the walkable ground height anywhere.

## Controls

Unchanged from Phase 9. New: a click recaptures the mouse when the "Click to look around" pill shows.

## Verification

- **`pnpm build`:** passes.
- **`pnpm lint`:** passes (eslint and prettier). All files are under 300 lines and all functions under 40.
- **`pnpm test`:** 27 files, 96 tests pass. New:
  - `land/plan.test.ts`:
    - deterministic heights
    - the city is flat and meets its edge just under the sidewalk
    - no cliffs (steepest neighbour step under 1.5, about 55 degrees, at hairpin cut banks)
    - the hill is 60 to 100 m
    - beach and water placement
    - every at-grade road sits on its cut ground within 0.4 m (the 30% trail within 0.8 m)
  - `land/highway.test.ts`:
    - highway and ramps within 6%; Hillside Drive within 8.5%
    - both bridges clear the road under them by more than 4.5 m
    - the lane graph has no gaps and every edge reaches every other
    - the GPS graph is fully connected, the summit route uses the switchbacks, and a far route uses the highway
  - `lod-instances.test.ts` gains a three-level case; `dynamic-res.test.ts` a hunting case.
- **`pnpm test:e2e`:** 8 pass. New `e2e/world.spec.ts` stands at the residential, hillside, forest, and flyover landmarks.
  - The Medium smoke test's timeout rose from 180 s to 300 s. In SwiftShader the rooftop view, which now takes in the whole map, made it time out once at 180 s with four tests in parallel; it then passed in 3.0 min.

### Performance (`scripts/perf.mjs`, 1920x1080 at DSF2, Apple M4, desktop Chrome sharing the GPU)

The probe has three new scenes (hillside, flyover, residential). It now settles 4 s per scene instead of 1.5 s: right after a teleport, dynamic resolution dips and climbs back over 2 to 3 s (traced second by second), and the probe should measure the steady state.

| Scene | Medium | High | Ultra |
|---|---|---|---|
| spawn | 60.1 | 42.2 | 18.7 |
| downtown | 60.0 | 46.5 | 24.2 |
| beach | 59.6 | 36.4 | 16.0 |
| canal | 60.0 | 45.7 | 21.0 |
| hillside | 60.0 | 51.6 | 25.8 |
| flyover | 60.0 | 46.6 | 29.4 |
| residential | 60.0 | 49.4 | 28.0 |
| downtown-night | 60.0 | 40.0 | 26.4 |

- **Medium:** holds 60, with dynamic resolution on as Medium always has. The beach reads 59.6 on this run and 56 to 60 across runs. The machine is noisy: the same uncapped view measured anywhere from 49 to 62 fps minutes apart.
- **High:** 36 to 52, against Phase 9's 31 to 50.
- **Ultra:** 16 to 29.
- **Load and download** (play to first frames; data transferred by then):

| | Phase 9 | 10a | Ratio |
|---|---|---|---|
| Load | 1.64 to 1.72 s | 2.34 to 2.65 s | about 1.5x |
| Download | 30.3 MB | 38 MB | 1.25x |

Both are under the 2x limit. The new download is the three terrain texture sets (7.3 MB).

### Screenshots (`.planning/phases/010a-screens/`)

From the production build in headless Chromium on the real GPU (ANGLE Metal). I looked at each of them and tuned from them: house and villa brightness, glass color, fence height, dune grass tone and density, beach prop whites, concrete normals, haze, and the map beach.

- `medium-*`, `high-*`, `ultra-*`: perf probe views.
- `hero-*`:
  - `hero-bridge-from-avenue`: the bridge on piers from Palm Avenue, skyline behind.
  - `hero-lookout`: the city from the summit.
  - `hero-switchback-villas`: the climb past the villa terraces.
  - `hero-residential`: the streets and houses.
  - `hero-beach-dunes`: dune grass, umbrellas, and a lifeguard tower.
  - `hero-highway-curve`: the north-west corner.
- `driving-on-flyover`: a car on the bridge deck.
- `map-desktop`, `map-tablet`, `map-phone`, `map-overview`: the full-screen map.
- `settings-phone`: the settings dialog at 390 px.

## Review fixes

Blockers from the review, both fixed:

- **Villa terrace z-fighting:** the slab top sat at the pad height the terrain is flattened to. It now sits 4 cm above it. `probe-villas` (same view as the review) shows clean white terraces.
- **Flat, placeholder-looking houses and villas:** dropped the 1.22x albedo boost, so walls stay below the tone-mapping clip and the stucco shading shows. Doubled the stucco normal strength. Windows now sit 0.13 m back in a 0.16 m surround with a projecting sill and a center mullion. There is a darker 0.4 m plinth, the front door has a surround, and the garage door has four sectional panels over dark seams. Fences are 14 cm block walls in the stucco material at a lower albedo. Villa glass is lighter and has dark frames and mullions, front and back.

Cheap notes also taken:

- Terrain rock now starts at about 42 degrees instead of 34, and the forest dirt tint is lighter, so hills read green with rock on the cuts.
- Depth of field: the calm focus range grows with camera height, so the skyline from the lookout is no longer blurred.
- World map: west of the coast, the space past the grid is painted ridge green instead of sea.
- `castShadows` walks a mesh tree only when an actor's in-range state flips. The car body swap clears the cached state.
- Traffic car pitch eases by frame time instead of once per path step.
- `exposeTestHook` and `lifeHelpers` are split under 40 lines.
- `setLookHint` writes to the DOM only on change.
- An SVG favicon ends the `/favicon.ico` 404.

Skipped, with reasons:

- **Lookout furniture** (railing, bench, paving): scenery for 10b.
- **Highway jam behind a player on foot in a lane:** needs a new behaviour (horn and pass, or a reroute), not a quick fix.
- **Chunking road meshes for culling:** no measured cost yet.
- **Lighter diagonal triangle in the bottom-left of the map base:** not investigated.
- **"Click to look around" hint:** still needs a manual check in a headed browser.

Verification after the fixes: `pnpm build`, `pnpm lint`, and `pnpm test` (27 files, 96 tests) pass. `pnpm test:e2e` gives 8 passed in 4.5 min. New shots in `.planning/phases/screens-p10a/`: `probe-villas`, `probe-villa-close`, `probe-house`, `probe-house-close`, `probe-house-street`, `desktop-forest`, `desktop-hillside-lookout`, and `probe-map-west-edge`. These are Medium quality on the Metal GPU at 1920x1080, with no page or console errors.

## Known gaps

- **Bare land:** no trees anywhere outside the city yet. The forest is only a reserved area with a dirt tint (Phase 10b), and the big fields between the city and the highway read empty.
- **No walkers or parked cars outside the city:** pedestrians still walk only the city sidewalks. There are no parked cars in residential driveways or at the villas.
- **Simple traffic:** highway traffic stays on the highway graph (main lanes, ramps, the crossing links, turnarounds). It does not turn onto Hill Road, Palm Avenue, or the residential streets, and no traffic drives the outer streets. There is no lane changing; cars use the outer lane.
- **GPS on ramps:** the GPS treats ramps as two-way.
- **Bridges:** the decks are the only bridges. The cut banks at the hairpins are steep (up to about 55 degrees, shown as rock), and there are no retaining walls on road cuts.
- **Simple models:** villas and houses are procedural boxes with a gabled roof, recessed windows, and a plinth: no interiors, porches, or roof details. Fences have colliders; loungers and umbrellas do not.
- **Map zoom:** the full map is still painted at 1 px per meter (now about 2860 x 2310), so it blurs past about 2x zoom. The terrain under it is a 4 m raster.
- **Perf caveats:** the beach is the tightest Medium scene, held by dynamic resolution. High and Ultra are well under 60 at 4K render on this machine, as they were before.
- **Unchecked:**
  - The "Click to look around" hint cannot be exercised in headless Chromium (no pointer lock); it was checked by reading the code path only.
  - No paid generation was used: no AssetHub, Higgsfield, or fal. All new assets are CC0 Poly Haven textures or procedural.
- **Process:** the Code Reviewer, Designer critique, and audit passes are still to run.
