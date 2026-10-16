# textures

CC0 PBR texture sets, 1k, one folder each: `diff.jpg` (color), `nor_gl.jpg` (OpenGL normal), `rough.jpg` (roughness). `src/world/materials.ts` loads them by folder name. Sources are in `../CREDITS.md`.

- `asphalt_02` roads
- `concrete_pavement_02` sidewalks
- `coast_sand_01` beach and seabed
- `aerial_grass_rock` park lawns
- `rocky_terrain_02`, `forest_ground_04`, `aerial_rocks_02`, `coast_sand_01` the terrain's four splat layers (grass, dirt, rock, sand), packed into texture arrays by `src/scenery/terrain-textures.ts`
- `white_stucco` facades, curbs, trim
- `water/waternormals.jpg` sea ripples (MIT, three.js examples)
