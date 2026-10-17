# scenery

Meshes and colliders for everything outside the city grid, built from `src/land`.

- `terrain.ts` entry for the ground: LOD tiles and one Rapier heightfield (past its edge, open sea and the offshore current)
- `terrain-mesh.ts` 256 m tiles with four detail levels (THREE.LOD) and crack-hiding skirts
- `terrain-material.ts` splat shader: grass, dirt, rock on slopes and the sea's cliffs (triplanar on steep faces), sand without a visible tile repeat, wet sand and its ripples, the damp foreshore below the berm, the wrack line, seabed tint
- `terrain-textures.ts` packs the four Poly Haven layers into two texture arrays
- `roads.ts` asphalt, paint, and concrete for every outer road, merged by material and cut along the terrain tiles
- `sweep.ts` sweeps a cross-section along a 3D line (road surfaces, barriers, decks)
- `markings.ts` lane paint per road kind; `bridges.ts` decks, parapets, piers (never in the water), median barrier, trimesh colliders, for the highway and any road over water
- `quays.ts` stone quay walls along the canal's channels outside the city
- `houses.ts`, `house-parts.ts` residential houses, drives, back-yard fences
- `villas.ts` hillside villas, terraces, pools, retaining walls
- `beach.ts` lifeguard towers, umbrellas, loungers; `dune-grass.ts` sea oats on the dune crests of every beach; `wrack.ts` seaweed and driftwood along the wrack line; `reeds.ts` reed beds in patches along the river banks and the lake shore
- `forest.ts` the Poly Haven trees (card trees near, lighter trunks with half the cards mid, impostors far), bushes, rocks, and their colliders; `thin-cards.ts` keeps every other leaf card, grown to fill in
- `grass.ts` grass clumps around the camera, swaying in the wind and fading out with distance; `grass-tiles.ts` caches their 29 m tiles, building a few per frame
- `lawn.ts` a lawn of real three-vertex blades on grassy ground near the camera, sharing the grass tile cache (patches from `src/land/lawn.ts`)
