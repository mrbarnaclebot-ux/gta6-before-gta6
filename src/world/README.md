# world

Builds the three.js meshes and Rapier colliders for the city plan from `src/city`.

- `city.ts` entry point: generates the layout, builds everything, returns spawn and landmarks
- `ground.ts` roads, raised sidewalks with curbs, park lawns
- `markings.ts` lane lines, crosswalks, stop lines (one draw call)
- `buildings.ts` facades, trim, roofs, merged per chunk; box colliders
- `facades.ts` procedural PBR window textures per building style
- `canal.ts` seawalls, bridges, railings, and swim-out steps (ramp colliders)
- `water.ts` reflective sea and canal water on the wave grid (shaders in `src/sea`); `wet-areas.ts` skips its mirror when no water is in view
- `impostor.ts` 4-triangle cards baked from a model, for far palms
- `underwater.ts` the wavy surface seen from below with a refracted Snell's window, light shafts, and motes; hides the reflective top while the camera is under
- `vegetation.ts` the generated palm (near and far versions, chosen per tree by distance in `lod-instances.ts`) and scanned ferns; `palm-model.ts` procedural palms if the glb fails
- `props.ts` streetlights, one instanced batch for the whole city
- `street-glow.ts` lamp light pools and the few real lights near the camera at night
- `neon.ts` neon tubes and their color wash on art-deco and tower facades at night
- `night-windows.ts` lit-window emissive maps for the facades
- `hospital-signs.ts` lightbox signs at the respawn points
- `instancing.ts`, `chunks.ts` instancing (grounded spots: height, tilt, tint) and frustum-culling helpers; `lod-instances.ts` levels of detail chosen per spot by distance, chunks that cannot change skipped
- `blocks.ts` shared geometry and collider helpers
- `materials.ts` Poly Haven PBR texture sets
