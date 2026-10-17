# world

Builds the three.js meshes and Rapier colliders for the city plan from `src/city`.

- `city.ts` entry point: generates the layout, builds everything, returns spawn and landmarks
- `ground.ts` roads, raised sidewalks with curbs, park lawns
- `markings.ts` lane lines, crosswalks, stop lines (one draw call)
- `buildings.ts` facades, trim, roofs, merged per chunk; box colliders
- `facades.ts` procedural PBR window textures per building style; `interior.ts` the rooms seen through every window (interior mapping), lit at night
- `shopfronts.ts` the owner's shopfront pictures on ground floors; `sign-material.ts` the material that draws them and the billboards from the sign atlas
- `furniture.ts`, `furniture-models.ts` benches, bins, hydrants, meters, newspaper boxes, bus stops, and signs on the sidewalks (placed by `src/city/furniture.ts`)
- `billboards.ts` parody billboards on low-rise roofs and on poles by the highway (placed by `src/land/billboards.ts`), with colliders for the picture, catwalk, legs and pole
- `rooftops.ts` AC units, water tanks, and antennas, merged into each chunk's trim
- `late-textures.ts` the room and sign atlases, loaded after the first frame
- `canal.ts` seawalls, railings, and swim-out steps (ramp colliders); `canal-bridges.ts` the humped street bridges a boat passes under
- `water.ts` reflective sea and canal water on the wave grid (shaders in `src/sea`); `wet-areas.ts` skips its mirror when no water is in view; `lake.ts` the forest lake's still surface
- `impostor.ts` 4-triangle cards baked from a model, for far palms
- `underwater.ts` the wavy surface seen from below with a refracted Snell's window, light shafts, and motes; hides the reflective top while the camera is under
- `vegetation.ts` the generated palm (near and far versions, chosen per tree by distance in `lod-instances.ts`) and scanned ferns; `palm-model.ts` procedural palms if the glb fails
- `props.ts` streetlights, one instanced batch for the whole city
- `street-glow.ts` lamp light pools and the few real lights near the camera at night
- `neon.ts` neon tubes and their color wash on art-deco and tower facades at night
- `hospital-signs.ts` lightbox signs at the respawn points
- `instancing.ts`, `chunks.ts` instancing (grounded spots: height, tilt, tint) and frustum-culling helpers, `splitByTile`; `lod-instances.ts` levels of detail chosen per spot by distance, chunks that cannot change skipped, far impostors on 800 m chunks
- `blocks.ts` shared geometry and collider helpers; `addTiled` merges and cuts meshes along the terrain tiles
- `static-colliders.ts` small fixed colliders (trunks, posts, buildings, houses) streamed in 128 m tiles around the player and camera; `rings.ts` the pure ring and hysteresis math
- `load-model.ts` the glTF loader: Meshopt geometry widened back to floats
- `materials.ts` Poly Haven PBR texture sets
