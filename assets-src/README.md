# assets-src

Source files for the GPU-compressed assets in `public/assets`; not served. `node scripts/compress-assets.mjs` rebuilds them (needs `basisu` and `ffmpeg`).

- `textures/<set>/{diff,nor_gl,rough}.jpg` Poly Haven 1k sets, become KTX2 under `public/assets/textures`
- `hdri/*.hdr` the full Poly Haven skies; only their top (sky) half is copied to `public/assets/hdri`
- `models/**.glb` the original models, become Meshopt-compressed glbs under `public/assets/models`

Licenses for both are in `public/assets/CREDITS.md`.
