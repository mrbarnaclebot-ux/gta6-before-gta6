# Phase 11 research: browser game optimisation for this codebase

Scope: what fits a vanilla three.js r186 + Rapier 0.21 (compat) + Vite game served as a static
build by Railpack's Caddy on Railway. Each section ends with the decision for this phase. Sources
are listed at the end; numbers marked "measured" come from `scripts/perf.mjs` on the M4.

## 1. What the baseline says (measured before any change)

- Cold load: 55 MB over 203 requests. 21 MB models, 20.6 MB JPEG textures, 7.2 MB HDRIs, 3.5 MB
  audio, 2.2 MB gzipped JS. Warm load still moved 46 MB: the static server sends no
  `Cache-Control`, so the browser revalidates or refetches.
- Play to first frame: 3.5 s cold or warm. It is CPU-bound: about 1.2 s of pure generation
  (land plan, flora, sea field), 0.4 s of JPEG decode and upload (`texSubImage2D`), 0.4 s
  waiting on shader links, the rest building meshes and colliders.
- In game, the main thread was busy 15 to 40 ms a frame. A CPU profile put Rapier's
  `World.step` on top: 0.21 calls `mapNewSoftBodies()` after every step, which walks every
  collider handle through a JS callback (`forEachColliderHandle`) and checks every mapped
  collider (`unmapRemovedColliders`). With about 40k static colliders that is O(colliders) of
  WASM-to-JS calls per physics step. This is the single biggest cost found, and it is not in
  the leftover list from Phase 10.

## 2. Textures: KTX2 / Basis Universal

- KTX2 with Basis Universal is a supercompressed GPU texture: it is transcoded in a worker to
  whatever the GPU takes (ASTC on Apple, BC7 on desktop, ETC2 on mobile) and uploaded without
  a JPEG/PNG decode or mip generation on the main thread. VRAM drops from 4 bytes per pixel
  (RGBA8) to 1 (ASTC 4x4 / BC7) and transfers shrink too. [1][2][3]
- Two modes: ETC1S (small, lower quality, good for albedo and roughness) and UASTC (near-BC7
  quality, larger, wanted for normal maps; add zstd supercompression). [2][4]
- Tooling: `gltf-transform etc1s|uastc` needs KTX-Software's `toktx`; Basis's own `basisu`
  (Homebrew `basis_universal`) writes `.ktx2` directly with `-ktx2`, `-uastc`, `-mipmap`,
  `-normal_map` and `-linear`. [4][5]
- Runtime: `KTX2Loader` from three's examples plus the Basis transcoder (`basis_transcoder.js`
  and `.wasm`, shipped in `three/examples/jsm/libs/basis`) served from a fixed path, and
  `GLTFLoader.setKTX2Loader` for `KHR_texture_basisu` in glTF files. [1][6]
- Decision: encode the terrain and building texture sets and the textures inside the glb models
  to KTX2 (ETC1S for color and roughness, UASTC + zstd for normals), compare screenshots, and keep
  JPEG as a fallback only if a set looks visibly worse.

## 3. Geometry: Meshopt

- `EXT_meshopt_compression` stores quantized, reordered vertex and index streams that a tiny
  WASM decoder (`meshopt_decoder.module.js`, already in three's examples) unpacks at tens of
  MB/s; it also covers animation data. Combined with HTTP gzip/zstd it typically shrinks
  geometry 3 to 5 times. [7][8]
- `gltf-transform meshopt` (or `optimize --compress meshopt`) applies quantization plus the
  extension; `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)` reads it. [5][7]
- Decision: run every glb through gltf-transform (dedup, prune, quantize, meshopt) as a repeatable
  script in `scripts/`.

## 4. HTTP caching and compression on Railway

- Railpack serves a Vite build with Caddy. Its default Caddyfile enables `encode gzip zstd`,
  `file_server` (ETag and Last-Modified) and `try_files`, but no `Cache-Control`. A
  `Caddyfile.template` or `Caddyfile` at the project root replaces it; the template is rendered
  with `{{.DIST_DIR}}` (`/app/dist`). [9][10]
- Caddy's `encode` only compresses a default list of MIME types (text, JSON, JS, wasm, SVG and a
  few more); `.glb` (`model/gltf-binary`) and `.hdr` are not on it. A custom `match` adds them:
  the mannequin animation file goes from 3.0 MB to 0.9 MB with zstd, the day HDRI from 5.5 to
  3.0 MB (measured with the CLI). [11]
- Hashed build output can be `Cache-Control: public, max-age=31536000, immutable`; files under
  `public/` keep their names, so they get `no-cache` (revalidate with the ETag) and the service
  worker below makes repeat visits free. [12][13]
- Decision: move Vite's output to `/build/` (hashed, immutable) so it cannot be confused with
  `public/assets` (unhashed), add a `Caddyfile.template` with the cache rules and the extra
  compressed types.

## 5. Service worker / Cache Storage for repeat visits

- A service worker can answer asset requests from Cache Storage with no network round trip at
  all, which ETag revalidation (one request per file, 200 files) cannot. [13][14]
- Versioning: a build step writes a manifest of content hashes for every file in `public/assets`;
  the worker keys each cached response by path plus hash, serves a hit only when the hash
  matches the current manifest, and deletes entries whose hash is gone. A deploy then
  re-downloads only the files that changed. The page itself (`index.html`) is network-first so a
  deploy is never hidden. [14][15]
- Decision: build it (`public/sw.js` plus a Vite plugin that writes `asset-manifest.json`),
  production builds only, the cache logic pure and unit-tested.

## 6. Start-up: shader prewarm, WASM init, play before everything is built

- `WebGLRenderer.compileAsync(scene, camera)` compiles every material the scene needs and,
  where `KHR_parallel_shader_compile` exists (Chrome does), resolves when the driver finishes
  without blocking the main thread; `renderer.debug.checkShaderErrors = false` avoids the
  synchronous `getProgramParameter` wait in production. [16][17]
- Rapier's compat build carries its WASM as base64 inside the JS; `RAPIER.init()` decodes and
  compiles it. Calling it while the menu is idle hides it. [18]
- The land plan, flora and sea field are pure data (typed arrays and plain objects), so they can
  be generated in a module Web Worker while the player is on the menu and posted back as a
  structured clone; heavy arrays can be transferred. [19]
- Decision: start Rapier and the world generation worker when the menu has painted; prewarm
  shaders with `compileAsync` behind the loading screen; load the night sky and other
  off-spawn assets after the first frame.

## 7. Chunked world, HLOD and streaming

- Open-world engines split the map into cells that load and unload in rings around the
  camera with hysteresis (load at R, unload at R plus a margin) so crossing a border does not
  thrash, and replace far cells with merged low-detail proxies (HLOD). [20][21]
- In a browser the expensive parts of streaming are main-thread work (building geometry,
  creating colliders, uploading textures, compiling shaders). Time-slicing them to a per-frame
  budget, or moving pure work to a worker, is what keeps frames under the 50 ms target. [19][22]
- This map already has much of the visual half: 256 m terrain tiles with four LODs, 250 m chunks
  for buildings and instanced plants with per-spot distance LOD and impostors. Missing: the
  collider half (about 40k trunk and rock colliders exist everywhere at once), the roads (one
  mesh per material for the whole map, never culled), and generation on the main thread.
- Decision: 128 m collider tiles streamed in rings around the player and any driven vehicle, a
  per-frame creation budget, roads split by terrain tile, generation in a worker. Far-ring
  visuals keep using the existing LODs and impostors as the HLOD; measure before adding a
  merged city proxy.

## 8. Occlusion culling for the city grid

- WebGL2 has occlusion queries (`ANY_SAMPLES_PASSED_CONSERVATIVE`), but results arrive a frame
  or more late, so they need a conservative scheme (draw last frame's visible set, test
  bounding boxes) and cost one query per tested object. [23][24]
- A precomputed potentially visible set over a regular grid is cheaper at run time and suits a
  street grid, but must be baked and only helps at street level among tall blocks. [25]
- Decision: measure how much of a downtown frame is hidden geometry first; implement only if it
  measures well (the game is mostly GPU-bound on fill and post effects, not draw calls).

## 9. Draw calls: BatchedMesh, atlases, material merging

- `THREE.BatchedMesh` draws many different geometries sharing one material in one call with
  per-instance matrices and visibility, using `WEBGL_multi_draw` where present. [26]
- Texture atlases or array textures let different props share one material, which is what
  makes merging or batching possible. [27]
- Decision: use it where a measured scene has many small static meshes with one material (the
  marina's piles, bollards and lamps are the lead suspect at 1120 draws on High).

## 10. Shadows

- Cascaded shadow maps redraw every caster each frame. Static casters can be rendered once into
  a cached map and only dynamic casters redrawn on top, at the cost of a second map per cascade
  and a re-bake when the sun moves (it moves slowly with the clock). [28]
- Decision: measure the shadow pass share first; implement only if it is a large share.

## 11. AI and physics LOD, pooling, zero allocations

- Update far pedestrians and traffic at a lower rate (every 2nd to 8th frame by distance),
  let Rapier sleep static and idle bodies, and keep per-frame code free of allocations so the GC
  does not pause mid-drive. [22][29]
- Object pools for particles, decals and audio voices are already in place; the wave query and
  the fish mesh are not (Phase 10 leftovers).
- Decision: fix the wave query allocations and pack awake fish schools (`mesh.count`).

## 12. Frame-time pacing

- Average fps hides hitches. Track p95 and p99 frame time and count frames over 50 ms, and run
  A/B tests interleaved because laptop thermals and other apps move the numbers. [22][30]
- Decision: `scripts/perf.mjs` records these for every scene and a full-map drive.

## 13. WebGPU (out of scope)

three.js's `WebGPURenderer` with TSL node materials runs on WebGPU (Chrome, Edge, Safari 26)
and falls back to WebGL2. It brings compute shaders (GPU culling, particle and grass
simulation) and indirect draws, but every custom `onBeforeCompile` shader in this game (water,
terrain splat, CSM, fog, foliage) would need rewriting in TSL, and pmndrs `postprocessing` and
N8AO are WebGL-only. A separate phase if ever. [31]

## Sources

1. three.js docs, KTX2Loader: https://threejs.org/docs/#examples/en/loaders/KTX2Loader
2. Khronos, KTX overview and Basis Universal: https://www.khronos.org/ktx/
3. Don McCurdy, "Choosing texture formats for WebGL and WebGPU applications": https://www.donmccurdy.com/2024/02/11/web-texture-formats/
4. Binomial, basis_universal README (basisu options): https://github.com/BinomialLLC/basis_universal
5. glTF Transform CLI: https://gltf-transform.dev/cli
6. KHR_texture_basisu: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu
7. meshoptimizer, glTF compression: https://meshoptimizer.org/gltf/
8. EXT_meshopt_compression: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression
9. Railpack, Node (SPA, custom Caddyfile): https://railpack.com/languages/node
10. Railpack default Caddyfile template: https://github.com/railwayapp/railpack/blob/main/core/providers/node/Caddyfile.template
11. Caddy `encode` directive: https://caddyserver.com/docs/caddyfile/directives/encode
12. MDN, Cache-Control: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
13. web.dev, HTTP cache: https://web.dev/articles/http-cache
14. MDN, Cache (Cache Storage API): https://developer.mozilla.org/en-US/docs/Web/API/Cache
15. web.dev, The service worker lifecycle: https://web.dev/articles/service-worker-lifecycle
16. three.js docs, WebGLRenderer.compileAsync: https://threejs.org/docs/#api/en/renderers/WebGLRenderer.compileAsync
17. KHR_parallel_shader_compile: https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/
18. Rapier JS getting started (init): https://rapier.rs/docs/user_guides/javascript/getting_started_js
19. MDN, Using Web Workers and transferable objects: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
20. Unreal Engine, World Partition: https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition-in-unreal-engine
21. Unreal Engine, Hierarchical Level of Detail: https://dev.epicgames.com/documentation/en-us/unreal-engine/hierarchical-level-of-detail-in-unreal-engine
22. web.dev, Optimize long tasks: https://web.dev/articles/optimize-long-tasks
23. MDN, WebGL2RenderingContext.beginQuery: https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/beginQuery
24. GPU Gems 2, ch. 6, Hardware Occlusion Queries Made Useful: https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-6-hardware-occlusion-queries-made-useful
25. Teller and Sequin, Visibility preprocessing for interactive walkthroughs (PVS), SIGGRAPH 1991: https://dl.acm.org/doi/10.1145/127719.122725
26. three.js docs, BatchedMesh: https://threejs.org/docs/#api/en/objects/BatchedMesh
27. three.js manual, optimizing lots of objects: https://threejs.org/manual/#en/optimize-lots-of-objects
28. Unity HDRP, shadow update mode (cached shadows): https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@latest/index.html?subfolder=/manual/Shadows-in-HDRP.html
29. Rapier docs, rigid body sleeping: https://rapier.rs/docs/user_guides/javascript/rigid_bodies
30. Chrome DevTools, Performance panel: https://developer.chrome.com/docs/devtools/performance
31. three.js docs, WebGPURenderer: https://threejs.org/docs/#api/en/renderers/webgpu/WebGPURenderer
