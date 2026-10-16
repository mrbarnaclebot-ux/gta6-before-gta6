# textures

CC0 PBR sets as KTX2 (Basis ETC1S, mipmapped), built by `scripts/compress-assets.mjs` from the 1k JPEG sources in `assets-src/textures`. One folder per set: `diff.ktx2` (color), `nor_gl.ktx2` (OpenGL normal), `rough.ktx2` (roughness). `src/world/materials.ts` loads them by folder name. Sources are in `../CREDITS.md`.

- `asphalt_02` roads
- `concrete_pavement_02` sidewalks
- `coast_sand_01` beach and seabed
- `aerial_grass_rock` park lawns
- `white_stucco` facades, curbs, trim
- `wood_planks_grey` marina decks
- `terrain_albedo.ktx2`, `terrain_normal.ktx2` the terrain's four splat layers (`rocky_terrain_02`, `forest_ground_04`, `aerial_rocks_02`, `coast_sand_01`: grass, dirt, rock, sand) as 2D array textures, color with roughness in alpha
- `grass_clumps.webp` grass card atlas
- `water/waternormals.jpg` sea ripples (MIT, three.js examples)
