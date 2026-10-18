# land

The island around the city as pure, seeded data: no three.js. `src/scenery` turns it into meshes and colliders.

- `world-plan.ts` runs `plan-worker.ts` in a Web Worker from the title screen (main-thread fallback); `make-plan.ts` is what it runs: the land, flora, sea field, and terrain splat
- `splat.ts` terrain splat inputs per grid vertex: sand, dirt (and lake mud), crown and dune-grass shade, variation
- `plan.ts` entry point `generateLand(seed, size)`: the city plan plus every road, house, and villa outside it, and the baked heightmap over a grid that reaches 520 m past the outermost coast
- `coast.ts` the island's coastline: a hand-placed outline, smoothed and wobbled, baked to signed distance and sandiness; `shoreline()` and `seaNormal()` give the way out to sea
- `shape.ts` natural ground: rolling fields and the hills inland; beaches (berm, face, dunes with blowouts, grassed back dunes) and rocky shores with cliffs of varied lean and knolls on top; the shelf falls to open-sea depth by 500 m out
- `waterways.ts` cuts every waterway in after the roads: `channels.ts` the canal's walled mouths, breakwaters, and branch; `river.ts` the sea-level river and its valley; `lake.ts` the forest lake (its own level), its basin, and its jetty
- `shore-rocks.ts` breakwater rubble, groynes, riprap heaped by noise, cliff-foot boulders, bedrock in the cliff faces, outcrops, and river stones
- `noise.ts` seeded gradient noise, fractal and ridged sums
- `grid.ts` the heightmap grid (Rapier's column-major layout) and bilinear sampling
- `stamp.ts` cuts and fills the ground to roads and building pads
- `profile.ts` road height profiles: smoothed ground, pinned ends, grade limits
- `polyline.ts` 2D/3D polyline helpers (arcs, splines, offsets, nearest point)
- `path.ts` the road record outside the grid: kind, width, centerline with heights
- `highway.ts` the U-shaped divided highway, its two diamond interchanges, turnaround loops, coast roads
- `hillside.ts` Hill Road, the switchbacks, villas on terraces, the lookout, the forest trail
- `residential.ts` Palm Avenue, curving side streets with cul-de-sacs, house lots; `house-designs.ts` the six Blender house models' footprints, and which ones the villas use
- `districts.ts` the forest area and the map labels for the outer districts
- `lane-graph.ts` directed highway lanes for traffic, with ramps and turnarounds
- `road-graph.ts`, `route-search.ts` the GPS graph over every road and A* by travel time
- `landmarks.ts` named spots outside the city for tests and the perf probe (coasts, river, lake, canal mouth too)
- `footing.ts` the one ground-placement helper: upright things on their lowest ground, rigid footprints (cars) on a fitted plane, rocks tilted with the slope
- `flora.ts` entry point `generateFlora(land)`: biome-aware trees, bushes, rocks, and palms, each set on the ground; `flora-rows.ts` avenue palms and front-yard hedges; `plant.ts` shared sizes, sink allowances, tints
- `poisson.ts` Poisson-disk points (a wrapping Bridson tile repeated over the map)
- `clearance.ts` a 2 m raster of where plants may grow: roads, buildings, the city blocked; yards garden only
- `grass.ts` grass clumps per 29 m tile from a fixed hashed grid; `lawn.ts` the lawn patches on the same tiles; `canopy.ts` shade under tree crowns for the terrain
- `beach-props.ts` the sandy shore's points and normals; lifeguard towers on every beach, umbrellas near town (kept off the pier)
- `marina-plan.ts` the pier, its T-head, piles and bollards, and where every boat is moored
- `*.test.ts` terrain, grade, bridge clearance, lane and road connectivity checks; `grounding.test.ts` checks nothing floats; `island.test.ts` the coastline, a boat's way out of the canal at both ends, the river to the sea, and roads on land or bridges
- `billboards.ts` where the billboards stand: some low-rise roofs, and poles beside the highway
