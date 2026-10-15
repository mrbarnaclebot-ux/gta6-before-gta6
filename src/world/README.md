# world

Builds the three.js meshes and Rapier colliders for the city plan from `src/city`.

- `city.ts` entry point: generates the layout, builds everything, returns spawn and landmarks
- `ground.ts` roads, raised sidewalks with curbs, park lawns
- `markings.ts` lane lines, crosswalks, stop lines (one draw call)
- `buildings.ts` facades, trim, roofs, merged per chunk; box colliders
- `facades.ts` procedural PBR window textures per building style
- `canal.ts` seawalls, bridges, railings
- `sand.ts` beach and seabed mesh plus heightfield collider
- `water.ts` reflective sea and canal water with depth-based color
- `vegetation.ts`, `palm-model.ts` instanced procedural palms and scanned ferns
- `props.ts` streetlights
- `instancing.ts`, `chunks.ts` instancing and frustum-culling helpers
- `blocks.ts` shared geometry and collider helpers
- `materials.ts` Poly Haven PBR texture sets
