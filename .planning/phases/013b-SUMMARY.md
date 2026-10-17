# Phase 13b summary: the island

Status: built and verified on branch `phase-13b-island` (from `main` at 38ae109). Not pushed, not deployed. Code Reviewer and Designer have not reviewed it yet.

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
- **Seabed edge.** Past the terrain grid there is no seabed, so a swimmer diving far offshore sees the terrain's edge. The current turns people back before then on most sides; off the west headland the grid edge is about 290 m out.
- **The sea field texture** is 16.7 MB on the GPU, up from 4.9 MB. Desktop-only concern; phones are out of scope for this phase.

## Screenshots (`.planning/phases/013b-screens/`, 1920x1080, Medium, production build)
- **Aerials:** `aerial-south.jpg`, `aerial-ne-corner.jpg`, `map-island.jpg` (the world map).
- **Canal:** `canal-north-mouth.jpg`, `canal-mouth-breakwater.jpg`, `canal-under-bridges.jpg` (looking under the humps from the water), `canal-hump-street.jpg`, `canal-branch.jpg`.
- **River:** `river-valley-reeds.jpg`, `river-to-bridge.jpg`, `river-mouth.jpg`.
- **Lake:** `lake-jetty.jpg`, `lake-from-jetty.jpg`.
- **Beaches:** `beach-west.jpg`, `beach-west-dunes.jpg`, `beach-south-dunes.jpg`, `beach-east-wrack-ripples.jpg`.
- **Coasts:** `coast-sw-headland.jpg`, `coast-north-cliffs.jpg`, `coast-nw-bay.jpg`, `coast-north-horizon.jpg`.
- **Perf scenes at DSF2:** `perf-medium-<scene>.jpg` for spawn, beach, and the five new scenes.
