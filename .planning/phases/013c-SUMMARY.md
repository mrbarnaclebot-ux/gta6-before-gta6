# Phase 13c summary: roads, lanes, and building placement

Status: built and verified on branch `phase-13c-roads` (from `main` at adae4e1). Review blockers fixed (see Review fixes at the end). Not pushed, not deployed.

## What changed

### The city is a street network now (`src/city/`)
- The 100 m grid of rects is gone. Streets are hand-drawn lines (`street-plan.ts`). `network.ts` cuts them where they meet into segments and junctions. It then traces the faces between them: 106 blocks, 6 paved walks (the city's edge strips and the beach promenade), and 7 small traffic islands.
- **Each face's curb line** is its sides' centerlines moved in by half the street (`faces.ts`). Where two streets meet, the curb turns a rounded corner: 6 m on avenues, 5 m on streets, 3 m at sharp corners, 1.5 m at alleys. Corners at the canal and the city's edge stay square.
- **Each face's lot line** is the curb line moved in by the sidewalk. Every stretch of a curb or lot remembers the street beyond it, so lamps, palms, furniture, shops, driveways and the curb's gutter know which way the street lies.
- **Street kinds** (`streets.ts`):
  - Avenues: four lanes, 18 m curb to curb, with a planted median.
  - Streets: one lane each way with a parking lane, 12 m.
  - Alleys: 6 m service lanes behind blocks, with a narrow 1 m walk.

### Breaking the grid
- **Uneven spacing.** North-south streets stand at x = -500, -410, -300, -200, -110, 0, 100 and 200. East-west streets stand at z = -500, -400, -300, -210, -120, 0, 100, 200, 300, 410 and 500.
- **Block sizes vary** from 55 to 150 m:
  - A gap in the street at x = -410 makes a downtown superblock (x -500 to -300, z -120 to 0).
  - Two short streets split blocks: z = 50 in midtown, z = -255 in the deco district.
- **Avenues:**
  - Hill Road (z = -300) and Palm Avenue (z = 300) run in from the west, where the roads outside pick them up.
  - Central Avenue runs north to south at x = -200.
- **The diagonal boulevard** runs at 45 degrees from the south edge (-450, 500) to the canal-side street (0, 50), across downtown and midtown.
  - It crosses each street midway between junctions. The corners it cuts off became plazas, pocket parks and planted islands.
  - It is about 640 m long, with 8 signalled junctions.
- **The coast road** bows inland by up to about 40 m mid-city, smoothly, so it still meets the coast roads to the highway's loops at x = 350 at both city edges.
  - Hotels front it on the west.
  - On the east, the promenade widens into a Lummus-Park-style strip: lawn pieces with palms, cut by footpaths to the beach every 50 m.
- **Service alleys** (`alley` kind) run behind the beachfront hotels (x = 255, the whole length), through two deco blocks (z = -165 and 150) and through one downtown block (x = -355).
- **Unchanged:**
  - The canal (it is a line in the network, so blocks stop at its walls).
  - The city's outline, the island and its coast from 13b, the highway and its links.
  - The spawn's beach, the hospitals' districts and the marina.

### Junctions, lanes, and paint (`junctions.ts`, `medians.ts`, `world/markings.ts`, `world/paint.ts`)
- **Junction control.** Every junction where an avenue meets another street has traffic lights: 47 junctions. Street-street junctions are all-way stops: 64. Streets passing the canal or an alley, and plain bends, have no control: 30.
- **Mouths.** Each street end's mouth is where it clears the crossing roads' curbs, worked out from the crossing angle. Zebra crosswalks and stop bars sit just past it.
- **Medians.** 33 raised, curbed, planted medians with palms run down the avenues.
  - Each stops 26 m before the stop bar, where a left-turn lane takes its place.
  - Each also stops well short of the canal's humps.
- **Road paint**, one draw call:
  - double yellow center lines
  - dashed lane lines on the avenues
  - turn-lane lines with left-turn and straight arrows
  - stop bars over the arriving lanes
  - zebra crosswalks
  - parking-lane lines with a tick at each bay
  - bays in the parking lots

  Paint follows the canal humps.
- **Curbs** (`world/curb-mesh.ts`): a swept section with a concrete gutter pan, a battered face, a chamfered edge and a 0.3 m top. Along the canal and the city's edge there is no gutter.
- **Driveways.** 129 curb cuts: a mountable ramp in the curb, plus a pale concrete apron across the sidewalk. They lead into parking lots and the larger buildings' garages. Palms, lamps and furniture keep off them.
- **Ground** (`world/ground.ts`, `world/slabs.ts`):
  - One asphalt surface covers the paved city, less the canal.
  - Every raised face is paving on a prism collider, cut into convex pieces of at most 40 m.
  - Lawns (parks, gardens, medians, islands, the promenade's strips) sit a step higher.

### Traffic lights and stop signs (`city/signal-posts.ts`, `world/signals.ts`, `life/signals.ts`)
- **Signals.** 172 mast-arm signals with Miami-yellow heads, 372 heads in all.
  - Each stands on the far side of its junction, on the driver's right, and reaches out over its approach's lanes with a head above each lane.
  - The lenses are one instanced mesh. Their colors follow a two-phase cycle per junction: 14 s green, 3 s amber, 2 s all red, then the cross street. Each junction is offset so the city's lights do not change together.
  - Lit lenses are bright enough to bloom at night.
- **Stop signs.** 232 procedural stop signs (an octagon with a STOP texture), one at each approach to an all-way stop.
- `TrafficLight.glb` was not used. Its low-poly look did not match the street; the procedural mast arm is closer to the references.

### Traffic follows the new lanes (`life/city-lanes.ts`, `life/city-lane-graph.ts`)
- **The lane graph.** City traffic drives a directed lane graph, the same shape as the highway's: 1,628 edges.
  - Each way along a street segment gets a right-hand lane that ends at its stop bar.
  - On avenues, the outer lane serves every maneuver and the inner lane serves straight on (added after review). A car that will turn left takes a third variant, which moves over into the turn lane once past the median's nose.
  - Connector curves join each lane end to every way out that its maneuver serves. Right turns hug the curb on an 8 m radius; other turns sweep wide.
  - There are no U-turns and no hairpins (past 120 degrees, at the diagonal's sharp corners). Lanes that lead only to dead ends (out of the city's edge), or that nothing leads into, are pruned.
- **Stopping.** Cars hold short of a red light. On amber they stop if they can and carry on if they cannot. At a stop sign they halt for 0.9 s, then go.
- The ten-car pool is now 12 (4 police). Spawns alternate between the city graph and the highway graph through one shared `laneStart`.
- The old grid router (`lanes.ts`' `nextLeg` and friends) is gone; `lanes.ts` now holds only the shared types.

### Pedestrians cross at crosswalks (`life/places.ts`, `life/crossings.ts`, `life/crowd.ts`, `life/pedestrian.ts`)
- **Loops.** People walk a loop round every block, 3 m in from the curb, with rounded corners. There is one more loop round the beach promenade.
- **Crossings.** 716 crosswalk crossings (both ways) link the loops at every junction with lights or stop signs.
  - Two in five people who reach one cross it.
  - At lights they wait at the curb until their crossing has a red for the cars with at least 10 s left, and give up after 45 s.
  - On the road they step down to the asphalt; the crowd reads the ground for them. Traffic already stops for people in its path.
- **Hospitals** stand on the sidewalk of each district's middle block, facing its southern street. Their lightbox signs turn to face it.

### Building placement (`city/lots.ts`, `city/cells.ts`, `city/massing.ts`, `world/buildings.ts`)
- **Cells.** A lot's bounds are split into rows and columns at jittered spacing. Neighbouring cells in a row sometimes merge, which gives varied frontages.
- **Setbacks.** Each cell's building is set back on its street sides (downtown 2 to 6 m, deco 0.4 to 1.6 m, beachfront 7 to 10 m of terrace on the sea side). It keeps a small gap to its neighbours.
- **Cut lots.** Where the diagonal or the coast road cuts a lot, the building shrinks a side at a time until it fits. Remnants become plazas.
- **Inner cells** with no street front are mostly courtyards (gardens or plazas), so blocks read as perimeter blocks.
- **Plazas.** 60 paved plazas get palms in round planters on an even grid. 16 big ones get a fountain (basin, column, bowl and water).
- **Corner towers.** Outside the deco district the tallest buildings of each block stand on its corners.
- **Neighbours never match.** No two neighbours of one style within 6 m share a wall color, and they differ by at least two floors (fixed after review, see Review fixes).
- **Podiums and towers.** 49 tall glass and residential buildings are a slim tower on a podium that fills the lot.
  - The podium is 2 to 6 floors with a terrace roof and parapet. The tower is pushed toward the block corner.
  - Towers are separate buildings with a `base`, so facades, colliders and neon work unchanged.
- **Rooftop clutter** (AC units, water tanks, antennas) stays on every roof but the podium terraces.
- **Districts.**
  - Downtown: dense and tall, 55% white residential towers and 45% glass. The average is 20 floors and the tallest 64.
  - Midtown: averages 10 floors.
  - Deco district: low and pastel, averaging 4 floors. The palette has one white and seven pastels.
  - Beachfront: hotels facing the sea, averaging 9 floors. Each hotel is a slab 18 to 26 m deep on the sea side of its lot, with its balconies on the east and west faces. Behind it is a pool deck: a sunken lap pool with coping (after review), pastel umbrellas and loungers. Deep lots also get a guest parking lot by the alley.
- **Parking lots.** 31 surface lots on deco and midtown edge cells and behind hotels, with painted bays. Up to 8 of the parked cars stand in them, nose in.

### Everything else follows the new streets
- **Parking.** Parked cars stand in the parking lanes' bays and in the lots.
- **GPS.** The road graph is the network's avenue and street segments. A new test checks that a route across the city uses the diagonal.
- **Maps.** The world map and minimap paint the streets as the ground, then the blocks, islands and medians over them with a dark casing, then lawns, buildings, the canal, and the bridges over it.
- **Surface heights.** `surfaceAt` finds sidewalks, lawns and roads through a 32 m grid index of the rings.
- **Placement.** Greenery, furniture, shops and roof billboards are placed along curb runs; shops check their own frontage, slot by slot. Canal bridges and banks come from the network's crossings, so the avenues' humps are 18 m wide.
- **Landmarks and perf scenes.** New: `boulevard` (on the diagonal's sidewalk, looking north-east) and `oceanDrive` (on the promenade, looking north up the coast road). The `downtown` landmark moved onto the sidewalk at x = -401. The wheel pool grew to 40 cars per kind (the lot cars).

## Controls
Unchanged.

## Measurements

All on an M4 at 1920x1080, DSF2, Medium, with `scripts/perf.mjs` against production builds on `vite preview`. The owner's Chrome was in use, so the machine's load varied from about 1 to 10 during the runs.

**Loading** (cold): 26.6 MB transferred on `main` and on the branch, so no change; this phase adds no assets. Play to first frame was 2.46 s on `main` and 2.40 s on the branch, measured 10 minutes apart at low load. JS heap after the scenes: 378 MB on `main`, 388 MB on the branch.

**Plan work:**
- `generateCity` takes 10 to 20 ms in node.
- The plan worker's `makePlan(7, 1000)` took 2.38 to 2.67 s with the machine busy (2.26 to 2.31 s at the end of 13b). The city's part of it is small.
- On the main thread at load:
  - building the city lane graph: 8 ms
  - the walking loops and crossings: 6 to 8 ms

**Every perf scene.** `main` at load 1.3, before any change; the branch at load about 3, after the label fix (`c-perf-br1`). Each cell reads fps / p99 ms / frames over 50 ms / draw calls / CPU ms per frame.

| Scene | main | branch |
|---|---|---|
| spawn | 60 / 16.8 / 0 / 437 / 4.95 | 58.4 / 33.4 / 2 / 423 / 5.50 |
| downtown | 60 / 16.8 / 0 / 396 / 3.12 | 60 / 16.8 / 0 / 437 / 4.29 |
| beach | 60 / 16.8 / 0 / 789 / 4.82 | 60 / 16.8 / 0 / 816 / 5.70 |
| shore | 60 / 16.8 / 0 / 213 / 4.04 | 60 / 16.8 / 0 / 229 / 4.32 |
| canal | 60 / 16.8 / 0 / 407 / 4.19 | 60 / 16.8 / 0 / 417 / 4.43 |
| marina | 60 / 16.8 / 0 / 758 / 5.35 | 60 / 16.8 / 0 / 829 / 6.03 |
| hillside | 60 / 16.8 / 0 / 699 / 4.76 | 60 / 16.8 / 0 / 722 / 5.44 |
| flyover | 60 / 16.8 / 0 / 536 / 4.63 | 60 / 16.8 / 0 / 608 / 4.90 |
| residential | 60 / 16.8 / 0 / 459 / 3.88 | 60 / 16.8 / 0 / 449 / 4.42 |
| forest | 60 / 16.8 / 0 / 428 / 2.67 | 60 / 16.8 / 0 / 428 / 3.14 |
| forest-hill | 60 / 16.8 / 0 / 344 / 3.77 | 60 / 16.8 / 0 / 342 / 4.40 |
| northCoast | 60 / 16.8 / 0 / 265 / 3.80 | 60 / 16.8 / 0 / 265 / 4.22 |
| westBeach | 60 / 16.8 / 0 / 307 / 3.80 | 60 / 16.8 / 0 / 359 / 4.35 |
| riverMouth | 60 / 16.8 / 0 / 384 / 4.07 | 60 / 16.8 / 0 / 293 / 4.53 |
| lake | 60 / 16.8 / 0 / 336 / 3.91 | 60 / 16.8 / 0 / 308 / 4.38 |
| canalMouth | 60 / 16.8 / 0 / 355 / 3.88 | 60 / 16.8 / 0 / 284 / 3.94 |
| boulevard (new) | | 60 / 16.8 / 0 / 504 / 4.48 |
| oceanDrive (new) | | 60 / 16.8 / 0 / 562 / 4.46 |
| underwater | 60 / 16.8 / 0 / 328 / 4.00 | 60 / 16.8 / 0 / 311 / 3.94 |
| downtown-night | 60 / 16.8 / 0 / 556 / 4.88 | 60 / 16.8 / 0 / 621 / 4.87 |
| drive: highway loop at 40 m/s | 60 / 16.8 / 0 / - / 3.79 | 60 / 16.8 / 0 / - / 3.93 |

**The city scenes, again.** After the last changes (alleys, plaza fountains, pool decks), alternating `main` and the branch on the city scenes (`c-ab2`).
- At load 2 to 4, `main` then the branch: every scene held 60 fps with p99 16.8 ms and no frame over 50 ms on both. That covers spawn, downtown, beach, canal, marina, downtown-night, boulevard and oceanDrive. Branch CPU per frame was 4.2 to 6.3 ms, `main`'s 3.5 to 6.4 ms.
- The second pair ran into a load spike (load 6.7 on the branch run). The branch dropped to 42 to 58 fps in several scenes, including marina, which this phase did not touch. Main-thread time rose to 14 to 21 ms everywhere, including scenes this phase did not touch.
- Two full runs (`c-ab-br-a`, `c-ab-br-b`) at load 5 to 9 showed the same drops: forest, marina and beach fell as much as the new city scenes.
- I read these drops as machine load, not the phase.

**The gate:**
- Medium holds 60 in every scene at normal load, with one exception: in the full run, spawn showed two start-up frames over 50 ms (58.4 fps).
- Spawn held 60 in both alternating runs at load 2 to 4. 13b recorded the same start-up hitch on the first scene.
- No page errors in any run.

## Tests and gates
- `pnpm build`: built (`tsc --noEmit` clean, Vite built).
- `pnpm lint`: clean (`All matched files use Prettier code style!`).
- `pnpm test`: 56 files, 204 tests passed. New and rewritten tests:
  - `src/city/layout.test.ts`:
    - determinism
    - a believable city: buildings, podium towers, medians, lots
    - the grid broken: a 45 degree diagonal, a coast road that bows more than 25 m, more than ten block sizes
    - every building inside its lot polygon, off the canal and apart from the others, and every tower on its podium
    - no building corner on any road or sidewalk (farther than half the street plus its sidewalk from every street centerline, the canal included) or in a median
    - curb stretches labelled with the street beyond them
    - no palm or lamp inside a building
  - `src/life/city-lanes.test.ts` (lane connectivity):
    - every lane edge leads on, and the next one starts exactly where it ends
    - the graph is strongly connected: every lane reaches every other, and back
    - every lane point is on the road surface (never on a curb, median or island), and over the humps at their height
    - stops: lights at signal junctions, stop signs at all-way stops
  - `src/life/places.test.ts`:
    - loops on raised sidewalk
    - loop wrapping and stations
    - crosswalks link two loops both ways over the road, 10 to 30 m long
    - a hospital per district
  - `src/city/parking.test.ts`: curb cars in the parking lane on the driver's right, lot cars on the lots, the first car near the spawn.
  - `src/city/shops.test.ts` and `src/city/furniture.test.ts`: rewritten for polygon lots and curb runs.
  - `src/land/highway.test.ts`: a GPS route across the city runs along the diagonal.
  - `src/land/island.test.ts`: every bridge over the canal reaches the hump's top.
- `pnpm test:e2e`: 15 passed (21.0 min, with the owner's Chrome busy; an earlier run in the phase passed in 17.1 min).

## Known gaps
- **Traffic.**
  - There are still 12 traffic cars and 24 people around the player, so most junctions are empty most of the time.
  - Left turns at lights are permissive: turners yield only to what is in front of them, not to oncoming traffic by rule.
  - City traffic still stays inside the city (13b's gap: no AI cars on Palm Avenue's river bridge). Lanes that leave by the edge are pruned.
- **Signal timing.** All junctions run the same 38 s cycle at fixed offsets: no green wave and no pedestrian signal heads. People wait for the cross traffic's red.
- **Parking lots** are sparsely filled: 8 cars across 31 lots, because each parked car is a physics car sharing the wheel pool. Static parked cars would fill them cheaply.
- **Alleys** have no dumpsters, back doors or fences yet (13d builds the street props).
- **Plaza and pool-deck props.** Plazas have planters, palms and fountains but no benches of their own; street benches stay on the sidewalks. The pool water is a flat, opaque turquoise surface without caustics. The pools are waist deep, for wading, not swimming.
- **Diagonal frontage.** Buildings along the diagonal stay square to the grid, stepping back from it (as along Broadway in New York). There is no flatiron-shaped building.
- **Avenue width at the city's edge.** Hill Road and Palm Avenue are 18 m wide inside the city and 14 m outside, and the width steps at the edge walk.
- **Highway signals.** The signals for the approach from outside at the west exits face cars that never come, since that lane is pruned.

## Screenshots (`.planning/phases/013c-screens/`, 1920x1080, Medium, dev build)
- **Before and after** (the same cameras on `main`): `before-aerial-diagonal.jpg` and `aerial-diagonal.jpg`; `before-aerial-ocean-drive.jpg` and `aerial-ocean-drive.jpg`; `before-street-junction.jpg` and `street-junction.jpg`.
- **Aerials:** `aerial-diagonal.jpg` (the boulevard, islands, medians, a park, podium towers), `aerial-downtown.jpg`, `aerial-deco.jpg` (deco blocks, hotel pools, canal humps), `aerial-ocean-drive.jpg` (the curving coast road, hotels, the promenade's lawns), `map-city.jpg`.
- **Streets:** `avenue-signals.jpg` (mast arms, turn arrows), `traffic-at-signals.jpg`, `street-junction.jpg` (rounded curbs, zebra crosswalks, stop bars, parking lanes), `crosswalk-people.jpg` (a walker on the zebra at an all-way stop), `diagonal-street.jpg` (a driveway apron), `coast-road.jpg`, `avenue-hump.jpg`, `alley.jpg`, `night-signals.jpg`.
- **Lots:** `plaza-fountain.jpg`, `parking-lot.jpg`, `pool-deck.jpg` (pool, umbrellas, guest parking).
- **Perf scenes at DSF2:** `perf-medium-boulevard.jpg`, `perf-medium-oceanDrive.jpg`.

## Review fixes

### Blocker: neighbours that matched (`city/massing.ts`)
- The old `vary()` fixed one neighbour at a time, so a later re-tint or re-height could bring back a clash with an earlier neighbour. The first version of this summary claimed that no two neighbours matched; that was not true (on seed 7: 10 same-style pairs shared a wall color, 25 were within one floor, 3 matched on both).
- Now each building gathers every same-style neighbour within 6 m first, then takes the nearest free palette color (deco 8, residential and glass 5) and the nearest height at least two floors from all of them at once. The loops are bounded at 64 steps.
- The rule is per style, as the review measured it (style plus color, style plus height). A white residential slab may stand beside a white deco building, since they differ in style.
- A podium is varied, not the tower over it: the street sees the podium. The tower takes the podium's color and base.
- New test in `city/layout.test.ts`: no two ground buildings of one style within 6 m share a palette color or come within a floor of each other (more than 100 such pairs are checked). It fails on the old code. A throwaway sweep over seeds 1 to 30 found 0 clashes in 195 to 296 pairs per seed.
- District averages are unchanged: deco 4.0 floors (was 4.1), midtown 10.2 (9.6), downtown 24.5 (25.8).

### Sunken hotel pools (`city/pools.ts`, `world/lots.ts`, `world/ground.ts`, `world/slabs.ts`)
- The pools were a water plane 5 cm above a deck the player walked on. Now each pool is a hole through the deck's paving, the plaza tiles, the deck's collider and the street collider under it, with tiled basin walls. The water stands 12 cm below the deck, under the coping.
- `flatRing` takes holes, `prismCollider` takes rects to leave out, and `polygon.ts` has `rectMinus`.
- Depth: the player wades in waist-deep water rather than swimming. The water stands on the hidden floor under the city's slabs (UNDER_CITY, -0.6 m), which the terrain heightfield also holds. Going deeper would mean carving the terrain grid under each pool. The player's water query includes the pools, so walking in slows to a wade. The camera's underwater effects still follow only the sea.
- New test: the pools are cut out of the ground with no area lost or overlapping, and the pool water reads at its level.

### Lawn tiling (`render/road-wear.ts`, `patchyLawn`)
- City lawns now blend in a second sample of the grass, rotated and at another scale, under slow world-space noise. They also get drier and lusher patches over tens of meters. The checkerboard is gone from the aerials. No new texture, no extra draw calls.

### Inner avenue lane (`life/city-lanes.ts`, `life/city-lane-graph.ts`)
- Every avenue way now has an inner lane for straight on. Straight-on connectors lead from the outer lane into either lane; a car already in the inner lane prefers to stay in it. Turns still leave from the outer lane or the turn lane.
- The lane graph grew from 1,628 to 1,954 edges and stays strongly connected (the existing tests pass). Over 60 s at Central Avenue: 83 car samples in inner lanes, 689 in outer lanes, 77 in turn lanes.

### Smaller notes
- **The beach range:** the new massing moves the city's random draws, and a promenade palm landed 5 cm off the line from the spawn to the middle target dummy, so the shooting e2e failed. `combat/dummy.ts` now also moves a dummy until no palm stands within 1.2 m of its line of fire.
- **Curb bays and driveways** (`city/parking.ts`, `world/markings.ts`): bays within half a driveway plus half a bay of a cut are dropped (2,604 bays become 2,432). Paint is drawn per run of bays, so the parking line and ticks stop at the cut. New test: no curb bay near a driveway.
- **Deco street wall** (`city/lots.ts`): the gap between neighbours went from 1.2 to 0.3 m. Merged frontages rose from 15% to 35%, and surface lots and gardens on street fronts went down. Rows read tighter, but most remaining gaps come from snapping footprints to whole 3 m window bays (`cells.ts` `snap`), so blocks are still not one continuous wall.
- **`buildLots`** is split: `plazaStone` builds the planters and fountains with their colliders. Every function in `world/lots.ts` is now under 40 lines.
- **`crowd.ts`**: the crosswalk check is a module function, and the crossing lookup is a loop, so no closures are made per person per frame.

### Not done
- **All-way stop order and left-turn yielding:** left as they are; the reviewer accepted them.
- **Bare downtown plazas** (benches, more planting) and **the downtown superblock's uniform slab:** these are design work for 13d's street props and massing. Not attempted here.
- **Pool swimming depth:** see above (the terrain grid would need carving).

### Gates after the fixes
- `pnpm build`: built. `pnpm lint`: clean.
- `pnpm test`: 56 files, 207 tests passed (3 new: neighbours, pool cut-outs, bays off driveways).
- `pnpm test:e2e`: 15 passed (16.7 min). The first run caught the range dummy (above); the run after that fix passed.
- **Perf**, `scripts/perf.mjs` at Medium, 1920x1080, DSF2, production build, load 2 to 3: every scene held 60 fps with p99 16.8 ms and no frame over 50 ms. That includes beach (draw calls 906, from 816), boulevard (569) and oceanDrive (492). The highway drive ran at 59.9. Cold transfer was 26.6 MB, unchanged; play to first frame took 2.51 s. No page errors.

### Screenshots (`013c-screens/`, dev build, Medium)
- `review-pool-deck.jpg`, `review-pool-edge.jpg`: the sunken pools, with the water below the coping.
- `review-pool-wade.jpg`: the player standing in a pool, waist deep.
- `review-aerial-diagonal.jpg`, `review-aerial-beachfront.jpg`: the lawns without the checkerboard (compare `aerial-diagonal.jpg`).
- `review-aerial-deco.jpg`: the tighter deco rows.
- `review-avenue.jpg`: an avenue's median lawn.
