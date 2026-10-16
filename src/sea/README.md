# sea

The ocean: waves, foam, the view from under the surface, and sea life.

- `waves.ts` pure Gerstner swell plus a shore-following surf wave; `waveHeightAt(x, z, t)` for swimming and later boats
- `field.ts` pure bake of depth, signed shore distance, and wave scale (calm canal, shallows) per 2 m texel
- `sea-glsl.ts` the same waves written out as GLSL, and the field as a half-float texture
- `sea-grid.ts` the camera-following water grid, dense near the middle (distance LOD)
- `water-shader.ts` patches three's Water: wave displacement, depth color, clarity, and foam
- `foam-texture.ts` procedural tileable foam bubbles
- `caustics.ts` underwater absorption and animated caustics, patched into lit materials
- `shafts.ts`, `motes.ts` underwater light shafts and drifting specks
- `boids.ts` pure fish school steering; `fish-model.ts`, `fish.ts` the instanced fish
- `reef-plan.ts` pure placement of reefs, seagrass, kelp, corals, and rocks; `seabed-models.ts` their procedural meshes
- `rays.ts` gliding eagle rays; `sea-life.ts` builds all sea life and culls it away from the reefs
- `sea-plan.ts` pure: the reefs and the baked field (runs in the plan worker)
- `sea.ts` entry point: adds the field's uniforms, builds the water, the underwater view, and the life
