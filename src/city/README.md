# city

Pure, seeded city plan: plain data, no three.js or physics. `src/world` turns it into meshes and colliders.

- `layout.ts` entry point `generateCity(seed, size, exits)`: road grid, blocks, districts, canal (open at both city edges), parks, spawn, and the roads that leave the city
- `canal-bridge.ts` the humped street bridges over the canal: their rise along the street, shared by meshes, colliders, lanes, and parking
- `lots.ts` building footprints, styles, and floor counts per district
- `greenery.ts` palm, bush, and streetlight spots on sidewalks, parks, and sand
- `parking.ts` curbside parked-car spots, the first one near the spawn
- `terrain.ts` ground, water (the sea's level, or the lake's), and walkable surface heights, read from the land heightmap (`src/land`)
- `rng.ts` seeded random numbers (Mulberry32) and pick/range helpers
- `furniture.ts` street furniture spots along the sidewalks
- `*.test.ts` determinism and layout invariants
- `shops.ts` ground-floor shop slots on the street walls of low-rise buildings (drawn by `world/shopfronts.ts`)
