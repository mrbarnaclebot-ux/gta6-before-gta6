# land

The 2 x 2 km world around the city as pure, seeded data: no three.js. `src/scenery` turns it into meshes and colliders.

- `world-plan.ts` runs `plan-worker.ts` in a Web Worker from the title screen (main-thread fallback); `make-plan.ts` is what it runs: the land, flora, sea field, and terrain splat
- `splat.ts` terrain splat inputs per grid vertex: sand, dirt, crown shade, variation
- `plan.ts` entry point `generateLand(seed, size)`: the city plan plus every road, house, and villa outside it, and the baked heightmap
- `shape.ts` natural ground: rolling fields, the hills, the edge ridge, the beach and dunes, the coast line
- `noise.ts` seeded gradient noise, fractal and ridged sums
- `grid.ts` the heightmap grid (Rapier's column-major layout) and bilinear sampling
- `stamp.ts` cuts and fills the ground to roads and building pads
- `profile.ts` road height profiles: smoothed ground, pinned ends, grade limits
- `polyline.ts` 2D/3D polyline helpers (arcs, splines, offsets, nearest point)
- `path.ts` the road record outside the grid: kind, width, centerline with heights
- `highway.ts` the U-shaped divided highway, its two diamond interchanges, turnaround loops, coast roads
- `hillside.ts` Hill Road, the switchbacks, villas on terraces, the lookout, the forest trail
- `residential.ts` Palm Avenue, curving side streets with cul-de-sacs, house lots
- `districts.ts` the forest area and the map labels for the outer districts
- `lane-graph.ts` directed highway lanes for traffic, with ramps and turnarounds
- `road-graph.ts`, `route-search.ts` the GPS graph over every road and A* by travel time
- `landmarks.ts` named spots outside the city for tests and the perf probe
- `footing.ts` the one ground-placement helper: upright things on their lowest ground, rigid footprints (cars) on a fitted plane, rocks tilted with the slope
- `flora.ts` entry point `generateFlora(land)`: biome-aware trees, bushes, rocks, and palms, each set on the ground; `flora-rows.ts` avenue palms and front-yard hedges; `plant.ts` shared sizes, sink allowances, tints
- `poisson.ts` Poisson-disk points (a wrapping Bridson tile repeated over the map)
- `clearance.ts` a 2 m raster of where plants may grow: roads, buildings, the city blocked; yards garden only
- `grass.ts` grass clumps per 29 m tile from a fixed hashed grid; `canopy.ts` shade under tree crowns for the terrain
- `beach-props.ts` lifeguard towers and umbrellas, set on the sand (kept off the pier)
- `marina-plan.ts` the pier, its T-head, piles and bollards, and where every boat is moored
- `*.test.ts` terrain, grade, bridge clearance, lane and road connectivity checks; `grounding.test.ts` checks nothing floats
