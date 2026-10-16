# vegetation

Source glbs for the plants and rocks; `node scripts/compress-assets.mjs` writes the served versions to `public/assets/models/vegetation`. Sources and licenses are in `public/assets/CREDITS.md`.

- `palm.glb`, `palm_far.glb` the generated city palm and its far version (`src/world/vegetation.ts`)
- `ph_fern_02.glb` Poly Haven fern, four nodes, planted in the city
- `fir_a.glb`, `fir_b.glb`, `jacaranda.glb`, `island_tree_01.glb`, `island_tree_02.glb`, `tree_small_02.glb` Poly Haven trees, baked into card trees for the forest (`src/scenery/forest.ts`)
- `bush_a.glb` to `bush_d.glb` Poly Haven bushes, merged into one `bushes.glb` by the compress script
- `rocks_moss_01.glb`, `rocks_moss_02.glb` mossy rocks for the forest and the sea floor (`src/sea/sea-life.ts`)
