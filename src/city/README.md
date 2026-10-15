# city

Pure, seeded city plan: plain data, no three.js or physics. `src/world` turns it into meshes and colliders.

- `layout.ts` entry point `generateCity(seed, size)`: road grid, blocks, districts, canal, parks, spawn
- `lots.ts` building footprints, styles, and floor counts per district
- `greenery.ts` palm, bush, and streetlight spots on sidewalks, parks, and sand
- `terrain.ts` beach, seabed, and canal floor heights; the shared terrain grid
- `rng.ts` seeded random numbers (Mulberry32) and pick/range helpers
- `layout.test.ts` determinism and layout invariants
