# Phase 13b summary: the island

Status: built and verified on branch `phase-13b-island` (from `main` at 38ae109). Not pushed, not deployed. Reviewed; the blockers are fixed (see Review fixes at the end).

## What changed

### The island (`src/land/coast.ts`, `src/land/shape.ts`)
- The coastline is a hand-placed outline of 58 control points. It is smoothed (a closed Catmull-Rom curve) and given a seeded wobble, then baked once into an 8 m raster of signed distance (positive out to sea) and how sandy the nearest shore is. The bake takes 20 ms in the plan worker.
- There is sea on every side. The ridge around the map edge and its invisible walls are gone.
- Three bays: the north-west bay between the highway and the hill, the west beach bay, and the south bay at the river mouth.
- Two rocky headlands with low cliffs: the west headland under the west hill, and the south-west headland. The hill's north side also drops to the sea in cliffs.
- Sandy beaches on all four sides:
  - east: the city beach, in the same place
  - north: the north-west bay and the north-east corner
  - west: the west beach
  - south: the south bay
- The city stays where it was.
  - The highway's two east legs moved in from z = ±840 to ±640. The north and south coasts now come close to the city, and the highway runs along the shore as a causeway, with riprap below it.
  - The terminal loops, coast roads, ramps and lane graph follow from `LEG_Z`, unchanged in code.
- Residential, hillside and forest keep their places and character.
  - Palm Avenue now runs on over the river to a turning circle on the far bank.
  - The forest hill moved east onto the west headland, and the trail over it now passes the lake.
  - The forest covers the island's west and the hill's northern flanks. The old northern forest band is now sea, so there are fewer trees: 10.5k conifers instead of 25.9k.
- Natural ground:
  - Inland: rolling fields and the hills.
  - Sandy shores ease down to the beach.
  - Rocky shores keep their height to the edge, then drop to the seabed. The cliffs are no steeper than about 50 degrees at their middle; the terrain test now allows 57 degrees (it allowed 55, and a hairpin bank cut already reaches 56).
- The terrain grid grew to keep seabed under the water round the island: 523k vertices (was 413k), 143 tiles of 256 m (was 120).

### The soft edge of the world (`src/sea/offshore.ts`)
- About 320 m off the coast a current sets in toward the island. It reaches full strength by 460 m.
- It carries swimmers back at up to 3.2 m/s. Checked in game: a swimmer sprinting outward 400 m off the west headland gained under 1 m/s. When he stopped, he drifted back at 2 m/s.
- It pushes boats back at up to 8 m/s², more than the outboard gives at full throttle.
- There is no wall: the sea and its horizon are open in every direction, from the beaches and from the hills.

### Water connections
- **The canal** (`src/city/layout.ts`, `src/land/channels.ts`, `src/scenery/quays.ts`):
  - It now runs through both city edges, and on between stone quays to the shore at z = −674 and +674.
  - From there it runs out between two rubble breakwaters into deep water, with the approach dredged to the canal's floor.
  - A branch canal leaves the south channel, runs west along the city's edge, and turns south to the sea under the highway.
- **Street bridges over the canal** (`src/city/canal-bridge.ts`, `src/world/canal-bridges.ts`):
  - All 11 streets over the canal, the two edge roads included, now hump over it.
  - Each hump is 1.65 m at the top, level over the water, and eases down over 22 m on each bank. It leaves 2.35 m clear above still water.
  - Parapet walls run along both edges and hide the drop to the sidewalk.
  - Traffic lanes climb over the humps (waypoints with heights), lane paint follows them, and parked cars keep off them.
  - The old flat decks are gone. They were 30 cm above the water and solid to the canal floor.
- **The highway** bridges each walled channel with its deck at 5.6 m: the underside is at 4.1 m, 5.3 m above the water, with no piers in the water. Traffic drives over these bridges, and over the humped streets.
- A boat can now leave the canal at either end, go round the island, and come back in. `island.test.ts` checks this with a flood fill over the water: each end of the canal reaches open sea with the canal's middle closed off.
- **The river** (`src/land/river.ts`):
  - It runs from a valley head at the foot of the hills, south past the residential district, to the south bay. It is about 16 m wide at the head and about 70 m at the mouth, with hand-placed bends and seeded meanders.
  - It is a sea-level estuary the whole way: the sea's surface fills it, and the depth field gives its depth.
  - Its channel and valley are cut after the roads are laid, so Palm Avenue keeps its height and crosses on a deck. Earth ramps are rebuilt under the bridge's approaches (`abutments()` in `plan.ts`).
  - It has muddy banks, reed beds and stones, and is calm (0.3 of the sea's waves).
  - The GPS routes over its bridge. Traffic does not, because traffic drives only the city and the highway (see known gaps).
- **The lake** (`src/land/lake.ts`, `src/world/lake.ts`):
  - It sits in the forest on the west hill's east flank. It has its own still surface at 17 m, is about 130 m across, and has a shelving shore and a 5.5 m deep bowl.
  - It is swimmable: the water query returns its level.
  - The surface is a cheap mirror-smooth disc that reflects the sky's environment map, with drifting ripples. It has no planar mirror.
  - A plank jetty off the east shore, where the trail now passes, reuses the marina's deck and pile builder and has a lamp at its end.

### Beaches
- **Profile:** dry sand rises to a berm crest 45 m from the coast line. The beach face falls about 1 in 7 to the waterline at 60 m. A low terrace follows, where the surf breaks, then the shelf.
- **Dunes:**
  - A foredune with a lower dune behind it. The crests wander and are broken into hummocks and blowouts, saddles the wind has cut, with their sand heaped up behind.
  - Up to about 4.5 m high on the far beaches, kept low (1.3 m) by the city.
  - Dune grass grows on the crests of every beach. The sand's inland edge wanders, and grass creeps over the back dunes.
- **In the ground shader:**
  - Ripples on wet sand and the shallow seabed, near the camera only, bent and patchy.
  - A darker wrack line at the high-tide mark.
  - Cliffs and other steep rock use triplanar mapping, so they are not streaks of stretched texture.
- **Wrack** (`src/scenery/wrack.ts`): seaweed and driftwood along the tide line of every beach.
- **Rocks** (`src/land/shore-rocks.ts`):
  - breakwater rubble at the canal mouths
  - groynes across the wild beaches
  - riprap and fallen boulders along every rocky shore
  - outcrops where sand meets rock
  - stones along the river banks

  All of them are the existing `rocks_moss` GLBs, paled. About 1,900 rocks were added. No new assets, so the cold transfer is unchanged.

### Everything follows the coast
- The sea field (depth, shore distance, wave scale) now covers the whole terrain grid; it used to stop at the canal. The canal and its channels are calm (0.15 of the sea's waves), and so is the river (0.3).
- Shore foam, surf and the swash on the sand follow from the field on every shore.
- Reefs, seagrass, kelp and surf rocks lie off every beach: 22 reefs (was 17).
- Lifeguard towers stand on every beach. Umbrellas stay near town.
- The world map and minimap draw the island, river, lake, canal mouths and branch. The waterline and the sand's edge are blended, so the zoomed-in minimap is smooth. Past the painted map it is sea, and the old ridge fill is gone. The lake and the west beach have map labels.
- GPS: the river bridge is part of Palm Avenue, and the humps are part of the city's streets.
- The player's spawn, the hospitals and the marina did not move.
- New landmarks and perf scenes: `northCoast`, `westBeach`, `riverMouth`, `lake`, `canalMouth`, plus `riverBridge` for screenshots.

## Controls
Unchanged.

## Measurements
All on an M4 at 1920x1080, DSF2, Medium, with `scripts/perf.mjs` against production builds on `vite preview`. `main` and the branch were run back to back. The owner's Chrome was open on the same machine (load average about 2 to 3).

| Loading | main | branch |
|---|---|---|
| Transferred, cold | 26.6 MB | 26.6 MB (no change) |
| Play to first frame, cold | 2.17 s | 2.21 s |
| JS heap after the scenes | 350 MB | 366 MB |
| Plan worker (node, `makePlan`) | 1.32 s | about 1.9 s |
| Sea field texture on the GPU | 4.9 MB | 16.7 MB |

- The plan worker's land, flora, splat and sea field steps take longer on the bigger grid and coast. The worker runs from the title screen, so with the perf probe's 1.5 s on the menu, Play still reaches the first frame in the same time.
- An early run with the machine busier measured play-to-frame at 3.05 s and 4.65 s, before the sea field bake was cut from 940 ms to 305 ms.

| Scene | fps main | fps branch | p99 ms main | p99 ms branch | >50 ms main | >50 ms branch | draw calls main | draw calls branch | CPU ms/frame main | CPU ms/frame branch |
|---|---|---|---|---|---|---|---|---|---|---|
| spawn | 60 | 52.8 | 16.8 | 33.4 | 0 | 2 | 456 | 427 | 5.39 | 6.02 |
| downtown | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 437 | 391 | 3.25 | 4.29 |
| beach | 60 | 59.2 | 16.8 | 33.3 | 0 | 0 | 795 | 785 | 4.91 | 10.94 |
| shore | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 191 | 202 | 3.89 | 4.19 |
| canal | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 400 | 387 | 4.84 | 4.38 |
| marina | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 703 | 789 | 5.03 | 5.29 |
| hillside | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 746 | 699 | 4.68 | 4.79 |
| flyover | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 586 | 538 | 4.47 | 4.74 |
| residential | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 433 | 453 | 3.85 | 3.76 |
| forest | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 382 | 419 | 2.94 | 2.73 |
| forest-hill | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 321 | 417 | 3.83 | 3.88 |
| northCoast (new) | | 60 | | 16.8 | | 0 | | 322 | | 3.66 |
| westBeach (new) | | 60 | | 16.8 | | 0 | | 254 | | 3.96 |
| riverMouth (new) | | 60 | | 16.8 | | 0 | | 289 | | 3.72 |
| lake (new) | | 60 | | 16.8 | | 0 | | 326 | | 3.89 |
| canalMouth (new) | | 60 | | 16.8 | | 0 | | 259 | | 3.91 |
| underwater | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 103 | 364 | 3.48 | 3.91 |
| downtown-night | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 544 | 551 | 4.97 | 4.97 |
| drive: highway loop at 40 m/s | 59.7 (86 s) | 60 (76 s, the loop is shorter) | 16.8 | 16.8 | 1 | 0 | | | 3.96 | 3.65 |

- **Medium gate:** 60 fps in every scene but the first two of the full run.
  - Spawn dropped to 52.8 with two frames over 50 ms, and beach to 59.2. Spawn is the first sample after loading, and its hitches are start-up work.
  - Three repeat runs of spawn, beach and forest alone, alternating builds (branch, main, branch), gave:
    - spawn: 60 and 60 on the branch, 59.2 on `main`
    - beach: 59.4 and 59.0 on the branch, 58.8 on `main`
    - forest: 60 everywhere
  - Beach main-thread time varies from run to run on the branch: 6.1, 8.4, 10.9 ms. It is a little higher than `main`'s 4.9 to 6.7 ms, from the extra instanced chunks along the beach (wrack, rocks, dune grass on every beach).
- **Draw calls:** within about ±100 of `main`, except underwater: 364, up from 103. The reef there sees more of the shore's instanced chunks. It still holds 60.
- **The terrain itself:** 523k grid vertices (+27%), 143 tiles (+23).
- **Plan-worker steps** (node, ms, `main` → branch, after the speed-ups): land 472 → 630, flora 508 → 520, splat 215 → 330, sea 129 → 305.
- **No page errors** in any run.

## Tests and gates
- `pnpm build`: built (`tsc --noEmit` clean, Vite built).
- `pnpm lint`: clean (`All matched files use Prettier code style!`).
- `pnpm test`: 55 files, 195 tests passed. New tests:
  - `src/land/island.test.ts`:
    - The city sits inland and there is deep water at the grid's edge in all eight directions.
    - Sandy beaches face at least three ways, and there are at least two rocky headlands.
    - A boat gets from each end of the canal to open sea with the canal's middle closed off.
    - Boats have clearance under the humps and the highway's channel bridges.
    - The river head is over 300 m inland and the river reaches open sea, as does the branch canal.
    - Every road point outside the city stands on land or on a deck, never buried and never in the water.
  - `src/sea/offshore.test.ts`: still water near the coast, full current far out all round, setting back toward the island.
  - `plan.test.ts` was updated:
    - the cliff limit
    - inland points that are now sea
    - the lake's and river's water
    - roads over water allowed on decks
- `pnpm test:e2e`: 15 passed (17.1 min).

## Known gaps
- **No traffic over the river.** Traffic drives only the city grid and the highway, so the river bridge on Palm Avenue carries GPS routes but no AI cars. Traffic does drive over the canal humps and the highway's channel bridges. Driving Palm Avenue would need outer-road lanes and U-turns at its turning circle.
- **The river is all sea level.** Its head is a valley at the foot of the hills, not a stream coming down from them. A sloping freshwater surface was out of reach with one shared sea surface.
- **No view from under the lake.** Swimming works, but diving gives no underwater look; the underwater view belongs to the sea.
- **Pedestrians cannot cross the canal humps.** The parapets keep the drop to the sidewalk safe, and people walk only their block's loop.
- **Waves on the west and north coasts.** The Gerstner swell still comes from the east everywhere. The shore-following surf wave breaks on every beach, but the open-sea swell runs away from the west coast.
- **The perf gate on the first scene.** In the full run, spawn showed two start-up hitches over 50 ms. Repeat runs held 60.
- **Seabed edge.** Fixed in review: the grid now reaches 520 m past the outermost coast on every side, beyond where the current is at full strength, and the open sea over its edge is opaque.
- **The sea field texture** is 16.7 MB on the GPU, up from 4.9 MB. Desktop-only concern; phones are out of scope for this phase.

## Screenshots (`.planning/phases/013b-screens/`, 1920x1080, Medium, production build)
- **Aerials:** `aerial-south.jpg`, `aerial-ne-corner.jpg`, `map-island.jpg` (the world map).
- **Canal:** `canal-north-mouth.jpg`, `canal-mouth-breakwater.jpg`, `canal-under-bridges.jpg` (looking under the humps from the water), `canal-hump-street.jpg`, `canal-branch.jpg`.
- **River:** `river-valley-reeds.jpg`, `river-to-bridge.jpg`, `river-mouth.jpg`.
- **Lake:** `lake-jetty.jpg`, `lake-from-jetty.jpg`.
- **Beaches:** `beach-west.jpg`, `beach-west-dunes.jpg`, `beach-south-dunes.jpg`, `beach-east-wrack-ripples.jpg`.
- **Coasts:** `coast-sw-headland.jpg`, `coast-north-cliffs.jpg`, `coast-nw-bay.jpg`, `coast-north-horizon.jpg`.
- **Perf scenes at DSF2:** `perf-medium-<scene>.jpg` for spawn, beach, and the five new scenes.

## Review fixes

After the Code Reviewer's and Designer's pass. Screenshots of each fix are in `.planning/phases/013b-screens/` with the prefix `fix-`.

### Blockers
1. **The seam where the terrain grid ended** (`src/land/plan.ts`, `src/land/shape.ts`, `src/sea/water-shader.ts`, `src/sea/sea-glsl.ts`)
   - The grid's reach now comes from the coast's bounds: 520 m (`OFFSHORE.full` + 60) past the outermost coast to the west, north and south, and at least the old 700 m east of the city. The grid is now x −2346..1066, z −1526..1474 (was −2114..1066, ±1314).
   - A new test (`offshore.test.ts`) checks that the current is at full strength all along the grid's edge, so no swimmer or boat reaches it. It fails on the old reach.
   - Past 300 m off the coast the seabed falls a further 18 m, reaching open-sea depth (about 29 m of water) by 500 m. Water deeper than 14 to 24 m is drawn opaque, and off the field the shader reads that same depth. So nothing under the water shows where the grid ends, from the sea or from the air. The open sea also turns a deeper blue past the shelf.
   - Re-filmed at the reviewer's two spots (`fix-edge-west-above.jpg`, `fix-edge-north-above.jpg`): no line.
2. **Rocky headlands and cliffs** (`src/land/shore-rocks.ts`, `src/land/shape.ts`, `src/scenery/terrain-material.ts`)
   - Riprap is now heaped by noise along the shore. Stones lie in piles with bare gaps between. Sizes fall off like scree: mostly 0.5 to 1.5, a few to 2.5. The distance from the waterline varies from 3.5 m up the cliff foot to 5 m out.
   - Big boulders (2.6 to 4.6) lie at the cliff foot or half drowned in the shallows. Clumps of bedrock (2.2 to 4.5) are sunk into the cliff faces.
   - The cliff face is no longer one even bank. Its lean varies between about 38 and 53 degrees along the shore. It is steep for most of its height (half linear, half eased), not only in the middle. On the wild shores the cliff tops rise into knolls up to about 3 m.
   - Within about 25 m of the sea, rock shows on gentler slopes (from about 25 degrees), except on sand. The headlands now read as rock, not smeared earth.
   - `BEDROCK_SINK` (0.3 of a rock's size) is the deepest any rock is set. The grounding test now bounds sinking by it.
3. **Reed beds** (`src/scenery/reeds.ts`)
   - Beds lie in patches set by noise, with open bank between.
   - Within a bed, 1 to 5 clumps stand per 4 m of bank. They are scattered from about 3.5 m into the water to 5 m up the mud, and the bed is thicker in its middle.
   - Clumps vary in height (1.1 to 2.7 m), lean, and tint (green to straw). There are two builds: a few tall stems (2 cards), and a thick tussock (4 cards).
   - The lake has patches in the shallows and on the bank, not a ring.
   - There are 557 clumps (was 1,047 in two fences). The second build costs one more draw call where reeds are in view.
4. **Beaches from above and from the ground** (`src/land/shape.ts`, `src/land/splat.ts`, `src/scenery/terrain-material.ts`)
   - Sand tiling: the sand layer blends two copies of its 4 m tile (one turned and shifted) by a slow noise. Farther away, a coarse turned tile takes over, with broad lighter and darker patches. From 140 m the square grid is gone.
   - Foredunes on the wild beaches now reach about 6 m (was 4.5) and are wider. Inland of the coast line, a hummocky field of older dunes up to about 4 m lies over the last 60 m.
   - Grass holds the back dunes on the wild beaches, in tongues, darker than the bare sand. The crests that dune grass holds are darkened in the ground's splat. So the vegetation reads from the air, beyond the 75 m where its cards are drawn.
   - Below the berm crest, the foreshore is drawn as damp, packed sand: darker, with a wandering edge about 15 m from the waterline. The crest and the tide line read from the air.
   - Re-filmed: `fix-aerial-beach-west.jpg`, `fix-aerial-south-bay.jpg`, `fix-westBeach-along.jpg`.
   - The landmark spot on the west beach (`westBeach`, 40 m out) is still on the flat part between the dunes and the water. That part of a real beach is flat.

### Notes taken
- **Lake** (`src/land/lake.ts`, `src/land/splat.ts`)
  - The shore is drawn out along one axis, with broader bays and points. It is no longer a near circle.
  - Its banks are mud of varying width, not a 3 m ring of sand. Sand is now only under the water.
  - The fan mesh's slightly stepped edge from above is unchanged.
- **Duplication:** `coast.ts` now has `seaNormal()` and `shoreline()`, used by shore rocks, beach props (`sandyShore`), landmarks, and the offshore current. Their four copies are gone.
- **Dune grass scan:** it skips ahead along each row where the coast distance shows the band is out of reach. It gives the same spots, in 15 ms instead of 26 ms. The check that dune grass grows at a point is now one function (`duneGrassAt` in `shape.ts`), shared with the splat.
- **Test hook:** `teleport(x, y, z, heading)` now turns a driven boat as well as a car (checked in game: heading 3.14 to 1.57).
- **Deep water colour:** the open sea past the shelf is a deeper blue in the water's own colour. From far off, the reflected hazy sky and the fog still dominate. The milky look is softer, not gone.

### Not done, for the owner to accept
- **Traffic over the river bridge:** AI traffic still does not use Palm Avenue's river bridge (see Known gaps). The GPS does.
- **The river:** it is still sea level all the way up, and the open-sea swell still runs from the east on every coast (see Known gaps).
- **Bridge parapets, hump undersides, quay walls and the highway's channel bridges:** still plain, untextured slabs.
- **The island connectivity test:** it still flood-fills heights only, ignoring colliders. I did not drive the south mouth or the branch canal in game.

### Corrections to the summary above
- The "Seabed edge" known gap no longer holds: the grid now ends past where the current is at full strength on every side, and the open sea is opaque over it.
- The terrain grid is now 640k vertices (was 523k before the fixes, 413k on `main`).

### Measurements after the fixes
Same setup as above (M4, 1920x1080, DSF2, Medium, `scripts/perf.mjs` on `vite preview`). The machine was busier this time: load average 5 to 8, with the owner's Chrome playing video.

- **Every perf scene holds 60 fps:** p99 16.8 ms, no frame over 50 ms. That covers spawn, downtown, beach, shore, canal, marina, hillside, flyover, residential, forest, forest-hill, northCoast, westBeach, riverMouth, lake, canalMouth, underwater, and downtown-night.
  - Draw calls are within about ±60 of the numbers above. Beach is 799, marina 821.
- **The 40 m/s highway drive:**
  - 59.2 fps in the full run (one frame over 50 ms), then 59.5 alone (three frames over 50 ms).
  - Back to back under the same load, the pre-fix branch build gave 58.0 (seven frames over 50 ms) and this build 56.7 (four frames over 50 ms). Load noise is bigger than any change from the fixes.
- **Cold load:**
  - Transfer is 26.6 MB, unchanged (no new assets).
  - Play to first frame is 2.53 s (2.21 s above, on a quieter machine).
  - JS heap is 367 MB at load and 379 MB after the scenes.
- **Plan worker** (node, `makePlan(7, 1000)`, three runs each, back to back): 1.73 to 1.82 s before the fixes, 2.26 to 2.31 s after, about +0.5 s.
  - Most of that is the bigger grid: 641k vertices, up from 524k.
  - The sea field texture is 20.5 MB on the GPU, up from 16.7 MB.
  - Load is out of scope this phase, so I left it.
- **Gates:**
  - `pnpm build` passes.
  - `pnpm lint` is clean.
  - `pnpm test`: 55 files, 196 tests passed. The new test checks that the current is at full strength all along the grid's edge.
  - `pnpm test:e2e`: 15 passed (14.9 min).

## Review fixes, round 2

Screenshots are in `.planning/phases/013b-screens/` with the prefix `fix2-`.

### Blocker
- **The canalMouth landmark stood inside breakwater rubble** (`src/land/landmarks.ts`, `src/land/shore-rocks.ts`, `src/land/landmarks.test.ts`)
  - The landmark is now 12 m in from the north mouth's shore (z −662), inland of where the west breakwater's rubble begins. The perf frame again shows the canal mouth: the player on the quay-side grass, the channel and the east breakwater ahead (`fix2-perf-medium-canalMouth.jpg`, `fix2-canalMouth.jpg`).
  - Each kind of shore rock now draws from its own random stream: riprap and outcrops on 651 (so they did not move), groynes on 652, breakwaters on 653, river stones on 654. Editing one kind no longer reshuffles the others. Groynes, breakwater rocks and river stones were reshuffled once by this change. The breakwaters keep the same rock count (82 to 85 each); see `fix2-aerial-north-mouth.jpg` and `fix2-north-moles.jpg`.
  - A new test checks that no rock (radius `s * ROCK_SPREAD`, plus the player's 0.35 m) covers any outer landmark. It fails on the old spot.

### Notes taken
- **The offshore current on boats** (`src/sea/offshore.ts` `setOnHull`, `src/boat/forces.ts`)
  - The water now moves shoreward at 3 m/s and drags the hull toward that speed. The push is capped at 8 m/s² (the old constant) and never pulls outward.
  - Measured in game: from 470 m off the west coast, heading west at full throttle, the boat drifts back at 1.9 m/s, easing to 1 m/s as it nears the weaker inner edge. With the engine off it drifts back at 3.1 m/s. A boat leaving the coast at full throttle peaks at 16.7 m/s, slows to a stop over about 7 s once in the current, then holds a 1 to 1.6 m/s drift back. Off the north coast at full strength, full throttle drifts back at 2.0 m/s. Before, the boat was driven back at up to 15.8 m/s.
  - A unit test steps one hull through the current at full throttle and checks it ends up drifting back at 1.5 to 3 m/s.
- **Quay keep-out** (`src/land/shore-rocks.ts`): a rock now stays out of a quay by its own size (at least the old 2 m), so big boulders and bedrock no longer overhang a quay edge. The dredged channels keep the 2 m margin on rock centres, because the breakwaters' rows edge them on purpose.
- **Coast line traced once** (`src/land/plan.ts`, `src/land/coast.ts`): `frameOf` passes its coast line to `bakeCoast`.

### Not done
- The breakwaters' inner row of rocks has always fallen inside the dredged channel's keep-out. So each breakwater shows a bare sand strip about 2.5 m wide along its channel side (`fix2-north-moles.jpg`). This is unchanged by this round. I left it, because closing it would let rocks into the boat channel.
- The lake's stepped rim from above, and the plain bridge parapets and quay walls, are unchanged (owner-accept list).
- The terrain shader cost note: no change. Perf held (below).

### Measurements after round 2
Same setup (M4, 1920x1080, DSF2, Medium, `scripts/perf.mjs` on `vite preview`). Load average was 13.6 when the run started and 1.7 when it ended.
- **Every perf scene holds 60 fps:** p99 16.8 ms and no frame over 50 ms in all 18 scenes. The 40 m/s highway drive also held 60 fps (p99 16.8 ms, no frame over 50 ms). canalMouth draws 271 calls.
- **Cold load:** 26.6 MB transferred (unchanged), play to first frame 2.37 s.
- **Gates:** `pnpm build` passes, `pnpm lint` is clean, `pnpm test` passes (56 files, 198 tests), and `pnpm test:e2e` passes (15 tests in 13.2 min, with nothing else running).
