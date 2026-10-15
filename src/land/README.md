# land

The 2 x 2 km world around the city as pure, seeded data: no three.js. `src/scenery` turns it into meshes and colliders.

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
- `*.test.ts` terrain, grade, bridge clearance, lane and road connectivity checks
