# Phase 12b summary: visual realism

Status: built and verified on branch `phase-12b-realism` (from `main`, with 12a merged). Not pushed, not deployed.

Code Reviewer and Designer have not reviewed this branch yet. The realism score is for the Designer to give. My own estimate against `ingame-examples/` is about 7 to 7.5 (it was 6). The streets and buildings gained the most. Vegetation and cars gained less.

## What was built

### Buildings
- **Interior mapping** (`src/world/interior.ts`). Every window looks into a room: one of the owner's six room pictures, traced as a box one bay wide, one floor high and 3.6 m deep.
  - Each window picks its own room, whether its blinds are down, and whether its light is on at night, from a hash of the window's center.
  - Offices light whole floors in 24 m runs. Homes light window by window.
  - The pane is real glass: little diffuse, a sharp Fresnel sky reflection, and the room showing through what it does not reflect. Tower curtain walls stay more mirror-like.
  - Deco and residential panes sit 14 to 18 cm behind the wall face, so the jambs, head and sill show as you move.
  - Once a window is a few pixels wide, its room blurs to the picture's mean and dims, so far towers do not shimmer or turn into orange tiles.
  - This replaces the lit-window emissive maps (`night-windows.ts` is deleted). The blinds the facade canvases used to paint are now drawn per window by the shader.
- **Shopfronts** (`src/city/shops.ts`, `src/world/shopfronts.ts`, `src/world/sign-material.ts`).
  - The eight shop pictures go on the ground floor of every low-rise wall within 4 m of the sidewalk, in the deco, beachfront and midtown districts. That includes the beach avenue and the canal walk.
  - Each is two bays wide and one floor high. Neighbors never repeat, and one slot in five stays plain wall.
  - Their bright parts glow after dark.
  - The ground-floor deco eyebrow is dropped so it no longer cuts across the signs.
- **Billboards** (`src/land/billboards.ts`, `src/world/billboards.ts`).
  - The two parody billboards stand on 1 in 9 low-rise roofs, turned toward the nearest street, and on 9 m poles every 260 m beside the highway, kept clear of every road.
  - They are lit at night.
  - All of them together are two meshes.
- **Rooftops** (`src/world/rooftops.ts`). AC units, water tanks on legs, and antennas. They are merged into each chunk's trim mesh (no extra draw calls) and have colliders. The rooftop landmark corner stays clear.
- **Balconies.** The residential balcony slabs got glossy glass rails.

### Ground
- **Lawn** (`src/land/lawn.ts`, `src/scenery/lawn.ts`).
  - Grassy ground within 10 m of the camera gets 150 real blades per 1.2 m patch. A blade is three vertices, with no alpha test, swaying in the wind and sinking into the ground at the edge of range.
  - The patches use the clump tile cache.
  - A 17 m ring, and a two-ring version with sparser far blades, were both measured: the thin far triangles dropped hillside and residential by 30 to 50% on High. The lawn stays near.
- **Terrain grass** (`terrain-material.ts`). The grass layer is pulled toward a green sward that keeps the photo's detail as brightness. A coarse mottle and the lush/dry patches break up the color, so far fields read green and continuous.
- **Road wear** (`src/render/road-wear.ts`). Procedural, in world space, with no textures:
  - repair patches, cast-iron manhole covers, and oil stains on city and outer asphalt
  - lane paint and crosswalks worn thin in places
  - weathered sidewalk paving with the odd stained slab
- **Street furniture** (`src/city/furniture.ts`, `src/world/furniture.ts`, `furniture-models.ts`).
  - Hydrants, benches with a bin, parking meters (downtown and midtown), newspaper boxes near corners, bus stops with the billboard ads on their end panels, and signs. All are procedural and kept clear of palms and lights.
  - They are merged per chunk into two materials, on the detail layer: not in the sea mirror, no shadow pass. Each has a box collider.

### Vegetation
- **Wind** (`src/render/foliage.ts`).
  - Palms, trees, bushes and ferns sway, more with height, from the same root for trunk and crown.
  - Palm fronds and ferns also flutter. Tree cards do not: that alone cost about 5% in the forest.
- **Backlit leaves.** Sunlight passes through leaves when you look toward the sun, plus a small lift that brightens the old dark, chunky cards near the camera.

### Cars (`src/vehicle/car-paint.ts`, `wheel-model.ts`)
- Paint is a metallic base (roughness 0.36, metalness 0.35) with faint flakes under a full clear coat (roughness 0.05).
- The glass is near-black and mirror-smooth.
- Only bright red texels glow as brake lights, not darker red seams in the baked map. I could not find the reported red patches in renders or in the texture: the only red texels at the rear are the lamp band.
- The wheels got twin spokes, lug nuts, and a brake disc.

### Lighting and post
- **Tone mapping.** AgX replaces ACES, so white facades and clouds no longer clip. The grade adds back saturation (1.14 to 1.4) and contrast (0.22 to 0.28). ACES, AgX and Neutral were compared side by side; plain AgX was too grey for Miami.
- **Background blur.** The depth-of-field background blur is softer (strength 0.75 to 0.45, range 160 to 260 m), so the skyline from the hills reads.
- **Sun haze.** The haze glows toward the sun (forward scattering) in every lit material's fog, matched in the sky dome below the horizon.
- **Screen-space reflections** (`src/render/ssr.ts`), High and Ultra only, through the Reflections setting (renamed from "Water reflections").
  - Tower glass and cars write how mirror-like they are into the color buffer's alpha.
  - A 28-step march through the depth buffer, weighted by Fresnel, shows what the ray hits on screen. Where it misses, the material's sky reflection stays.
  - Up to 10% of High's frame rate in the A/B runs. Medium and Low have no SSR.

### Characters (`src/render/skin.ts`)
- Skin (found by hue, as the outfit dye finds it) gets light that wraps past the shadow line, reddened, and a softer sheen.
- Clothes go matte.
- This applies to the player and every pedestrian outfit.

## The owner's textures

`assets-src/textures/rooms/` and `assets-src/textures/signs/` hold the 16 originals with `SOURCE.md`. `node scripts/compress-assets.mjs atlases` builds two KTX2 (ETC1S) 2D-array textures:

| File | Layers | Size |
|---|---|---|
| `rooms.ktx2` | 6 x 512 px | 0.31 MB |
| `signs.ktx2` | 10 x 1024x576 | 1.08 MB |

They load after the first frame (`src/world/late-textures.ts`), with flat stand-ins until then. They are credited as owner-generated in `public/assets/CREDITS.md`. No credits were spent.

## Before and after (M4, 1920x1080 at DSF2, `scripts/perf.mjs`, production build behind Caddy)

"Before" is `main` and "after" is this branch, measured back to back in the same session. The Mac was busier mid-session: one run of `main` measured beach at 49 fps on Medium, so single numbers move by several fps.

| Loading | Before | After |
|---|---|---|
| Transferred, cold | 22.6 MB | 24.0 MB (+1.4 MB, the atlases after the first frame) |
| Play to first frame, cold, Medium | 1.94 s | 2.30 s |
| Play to first frame, warm, Medium | 3.27 s | 3.00 s |
| JS heap after the scenes, Medium | 310 MB | 358 MB |

Medium

| Scene | fps before | fps after | p99 ms before | after | frames > 50 ms before | after | draw calls before | after |
|---|---|---|---|---|---|---|---|---|
| spawn | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 498 | 512 |
| downtown | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 368 | 450 |
| beach | 59.6 | 60 | 16.8 | 16.8 | 0 | 0 | 675 | 730 |
| shore | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 255 | 191 |
| canal | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 401 | 402 |
| marina | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 644 | 705 |
| hillside | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 658 | 786 |
| flyover | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 565 | 578 |
| residential | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 425 | 439 |
| forest | 58.6 | 60 | 33.3 | 16.8 | 0 | 0 | 488 | 460 |
| forest-hill | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 370 | 331 |
| underwater | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 100 | 130 |
| downtown-night | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 480 | 546 |
| drive: highway loop at 40 m/s, 86 s | 59.5 | 59.5 | 16.8 | 16.8 | 2 | 1 | | |

High

| Scene | fps before | fps after | p99 ms before | after | frames > 50 ms before | after | draw calls before | after |
|---|---|---|---|---|---|---|---|---|
| spawn | 40.5 | 37.6 | 33.4 | 33.4 | 0 | 0 | 444 | 489 |
| downtown | 48 | 43.1 | 33.4 | 33.4 | 0 | 0 | 429 | 475 |
| beach | 36.8 | 33.3 | 33.5 | 33.5 | 0 | 0 | 813 | 888 |
| shore | 54 | 50.8 | 33.4 | 33.4 | 0 | 0 | 190 | 196 |
| canal | 46.8 | 40.2 | 33.4 | 33.4 | 0 | 0 | 364 | 474 |
| marina | 38.9 | 35.8 | 33.4 | 33.4 | 0 | 0 | 792 | 869 |
| hillside | 42.3 | 37.6 | 33.4 | 33.4 | 0 | 0 | 790 | 871 |
| flyover | 42.9 | 40.5 | 33.4 | 33.4 | 0 | 0 | 579 | 609 |
| residential | 37.5 | 35.2 | 33.4 | 33.4 | 0 | 0 | 486 | 419 |
| forest | 28.2 | 27.4 | 50.1 | 50.1 | 2 | 6 | 390 | 392 |
| forest-hill | 51.8 | 48.4 | 33.4 | 33.4 | 0 | 0 | 474 | 368 |
| underwater | 59.4 | 57.6 | 33.3 | 33.4 | 0 | 0 | 144 | 105 |
| downtown-night | 49.8 | 44.3 | 33.4 | 33.4 | 0 | 0 | 562 | 566 |
| drive: highway loop at 40 m/s, 86 s | 46.9 | 42.5 | 33.4 | 33.4 | 0 | 3 | | |

Low on a phone-sized window (844x390, touch)

| Scene | fps before | fps after | p99 ms before | after | frames > 50 ms before | after | draw calls before | after |
|---|---|---|---|---|---|---|---|---|
| spawn | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 361 | 381 |
| downtown | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 336 | 366 |
| beach | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 571 | 643 |
| shore | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 185 | 192 |
| canal | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 329 | 375 |
| marina | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 565 | 629 |
| hillside | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 553 | 586 |
| flyover | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 445 | 473 |
| residential | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 298 | 304 |
| forest | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 345 | 345 |
| forest-hill | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 249 | 252 |
| underwater | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 76 | 79 |
| downtown-night | 60 | 60 | 16.8 | 16.8 | 0 | 0 | 448 | 520 |
| drive: highway loop at 40 m/s, 86 s | 60 | 60 | 16.8 | 16.8 | 0 | 0 | | |

- **Medium (the gate):** 60 fps in all 13 scenes. On the drive, 59.5 fps with 1 frame over 50 ms (before: 2).
  - That table is the final build.
  - The run just before the last tweak (tree-card flutter off, balcony rails out of the sea mirror) had spawn at 58.6, marina at 58.2 and forest at 57.2.
  - In that same session `main` itself had forest at 58.6.
- **High:** 3 to 6 fps lower in most scenes, from SSR and the extra detail. Interleaved uncapped A/B runs put it at 7 to 11%.
- **Low on a phone-sized window:** 60 in every scene.
- **Draw calls:** at most about 120 more per frame.

## Measured and not done
- **Two-ring and 17 m lawn:** too costly (see Ground).
- **Contact shadows:** N8AO at Medium and above already grounds cars, people and props. A separate screen-space shadow pass was not added.
- **Puddles:** there is no weather.
- **Wet-road SSR:** dry asphalt does not mirror. Only glass and cars write a reflection mask.
- **Rounded curbs:** the curb is still a box. A chamfer strip is the upgrade.
- **Distant tower geometry LOD:** not changed. Far windows now carry room color and lit/blind variation from the interior shader instead.

## Controls

Unchanged. Settings: the "Water reflections" row is now "Reflections". High and Ultra on it add screen-space reflections.

## Known gaps
- SSR works only on what is on screen: reflections of things behind the camera fall back to the sky. Thin objects can leave short streaks at grazing angles.
- Interior rooms are pictures: the same six rooms repeat, and a room's perspective is right only near head-on.
- Shopfronts are flat pictures on the wall, with no awning depth.
- With Low (no post-processing), the haze's glow toward the sun is added after tone mapping. It reads a little brighter there than on Medium.
- The furniture has no real lights: bus stop ads glow only through the sign material.
- The generated car bodies are still lumpy meshes. Paint and reflections cannot fix their shape.
- Only the player and pedestrians got skin shading. The skin mask is by hue, so tan clothing can pick up a touch of it.

## Screenshots (`.planning/phases/012b-screens/`, before on the left, after on the right)
- `medium-<scene>.jpg` and `high-<scene>.jpg`: the 13 perf scenes plus `drive-end`, at Medium and High.
- `view-avenue.jpg`: shopfronts on the beach avenue.
- `view-facade.jpg`: interior-mapped tower glass.
- `view-roofs.jpg`: rooftops, billboards, rooms.
- `view-aerial.jpg`: the beachfront from above.
- `view-nightave.jpg`: the avenue at night.
- `view-car4.jpg`: a parked car.
- `view-residential.jpg`, `view-forest.jpg`.

## Test results
- `pnpm install --frozen-lockfile`: up to date.
- `pnpm build`: built.
- `pnpm lint`: clean.
- `pnpm test`: 51 files, 179 tests passed. New: shop placement, lawn tiles, furniture placement, billboard placement.
- `pnpm test:e2e`: 15 passed (16.6 min). An earlier run failed 4 specs because I edited files while it ran: the dev server reloaded and dropped `window.__game`.
