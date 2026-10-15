# scenery

Meshes and colliders for everything outside the city grid, built from `src/land`.

- `terrain.ts` entry for the ground: LOD tiles, one Rapier heightfield, edge walls
- `terrain-mesh.ts` 256 m tiles with four detail levels (THREE.LOD) and crack-hiding skirts
- `terrain-material.ts` splat shader: grass, dirt, rock on slopes, sand, wet sand, seabed tint
- `terrain-textures.ts` packs the four Poly Haven layers into two texture arrays
- `roads.ts` asphalt, paint, and concrete for every outer road, merged by material
- `sweep.ts` sweeps a cross-section along a 3D line (road surfaces, barriers, decks)
- `markings.ts` lane paint per road kind; `bridges.ts` decks, parapets, piers, median barrier, trimesh colliders
- `houses.ts`, `house-parts.ts` residential houses, drives, back-yard fences
- `villas.ts` hillside villas, terraces, pools, retaining walls
- `beach.ts` lifeguard towers, umbrellas, loungers; `dune-grass.ts` sea oats on the dune crests
