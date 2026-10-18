# Phase 13d summary: Blender assets in the game

Status: built and verified on branch `phase-13d-assets` (from `main` at 5f71d05, with `phase-13d-blender` merged in: no conflicts). Not pushed, not deployed.

## What changed

### Cars (`src/vehicle/`)
- **Six kinds.** `CarKind` is now sports, police, sedan, SUV, pickup, and van. Parked cars (`fleet.ts`) and traffic (`life/traffic.ts`) pick a civilian kind and a paint from one variant number (`car-specs.ts` `civilian`, `paintOf`), weighted toward sedans and SUVs: sedan 2, SUV 2, sports 1, pickup 1, van 1 in 7. Every third traffic car is still a police cruiser. Residential driveways get the same mix, and carjacking hands over whatever kind was stolen (a replacement of the same kind takes its place).
- **Paint variants.** Sedan 7, SUV 6, pickup 6, van 5 (mostly white, silver, black, with navy, maroon, champagne, deep green, sand, light blue), sports 6 (orange, red, turquoise, pink, white, black), police black and white.
- **The Blender sedan, SUV, pickup, and van** (`car-bodies.ts`, `car-paint.ts`):
  - Each glb is baked into one opaque mesh and one glass mesh per level of detail (`world/bake-parts.ts`): every vertex carries its material (color, roughness, metalness, clear coat, and a code), so a body of 14 materials is one draw call plus its glass.
  - The node transforms are baked in, so Meshopt's node scale cannot shrink or grow a body (the Phase 11 bug). `car-model.test.ts` loads every shipped glb and checks the baked body's length and height and the wheel's radius and width against `CAR_SPECS`, and the specs' wheel numbers against the glb's own extras.
  - The shader repaints the `paint` parts, keeps the clear coat and metal flakes, and lights the head and tail lamps from the car's lamp uniform (headlights, brake and tail lights, as before).
  - The glass is a shared see-through tinted material, so the interior and the seated driver show. It casts no shadow.
  - LOD: past 70 m a car draws the low-detail level, with its glass merged in as opaque (one draw call per distant car).
  - Wheels: the glb's own wheel (tyre, rim, disc), one instanced batch per kind and level (`wheel-batch.ts`), near and far. Far wheels cast no shadow.
  - Physics: each kind's body box, wheel hubs, radius, and seat come from the Blender specs in meters (`car-specs.ts`). The van and pickup sit higher and longer, so the chase camera now rises and pulls back with the car's roof height (`camera/follow-camera.ts` `carRig`).
- **Sports car and police cruiser: kept the old ones.** Side by side in the game (screens `traffic-police.jpg`, `sports-generated.jpg` against the Blender pair), the generated (AssetHub) bodies look clearly more detailed: the Blender sports car read as a plain 90s coupe next to the generated supercar, and the Blender cruiser as a toy next to the Charger-like one. So these two kinds keep their generated bodies, procedural wheels, sizes, and shader (`generated-paint.ts`, the old `car-paint.ts`). `car_sports.glb` and `car_police.glb` still ship from the Blender library but are not loaded.

### Houses (`src/scenery/houses.ts`, `house-models.ts`, `villas.ts`, `src/land/house-designs.ts`)
- The procedural houses (`house-parts.ts`, deleted) are replaced by the six Blender houses: ranch, Mediterranean, modern, art deco, Key West, and Spanish revival.
- **Residential:** each lot picks a design (`land/residential.ts`), and the lot takes that design's footprint, so the pad, driveway, hedges, and parked car all line up with the model's garage. Houses with the garage on the left are the model mirrored.
- **Hillside** (changed in review: modern and Spanish only, with a drive to the road): the 15 villas use the modern, Spanish, and Mediterranean designs on their terraces (`VILLA_DESIGNS`), moved 0.8 m forward so the pool decks stay inside the retaining wall. The terrace, retaining wall, and (for the Mediterranean, which has none of its own) the pool stay procedural.
- **Drawing:** one batch per design per level of detail (LOD1 past 100 m), instanced through `lod-instances.ts`. Each design is baked into one mesh drawn by one material (`house-models.ts`): the stucco, clay tile, and standing-seam metal textures from the glb are picked per vertex. Mirrored houses are drawn double-sided with the face direction flipped in the shader, so one batch holds both.
- **Paint:** each house's walls take one of eight Miami pastels (instance color on the stucco only); roofs, trim, doors, and pools keep the model's colors.
- **Colliders:** boxes per design for the main block and wing, plus the low garden walls and picket fences. Porches and pool decks stay open.
- Hedges are skipped in front of houses that have their own garden wall or fence (`land/flora-rows.ts`).

### Street props (`src/world/prop-kit.ts`, `kit-furniture.ts`, `furniture.ts`, `furniture-models.ts`, `src/city/plaza-furniture.ts`)
- `prop-kit.ts` loads the street kit, awnings, and lifeguard tower and bakes each prop into one geometry (see-through panes kept apart).
- **Sidewalks:** benches, bins, hydrants, and bus shelters are the Blender models. The bus shelters keep the sign atlas pictures on their advert panel, and their glass is see-through. Meters, newspaper boxes, and signs stay procedural, merged per chunk as before.
  - The Blender ones are instanced per kind and drawn only near the camera (`kit-furniture.ts`): hydrants and bins to 90 m, benches to 110 m, shelters and kiosks to 220 m. Merging them all over the city, as the old procedural pieces were, added about 0.5 M triangles to a downtown view.
  - Detail layer, as before: main view only, no shadow pass.
- **Plazas (new):** a bench facing into the plaza on the inner side of every other palm planter, four round each fountain, a bin beside every other bench, and a kiosk in the middle of the bigger plazas without a fountain (9 on seed 7). 13c had left the plazas bare.
- Every item has a box collider, as before (kiosk added).

### Awnings (`src/world/awnings.ts`, `src/city/shops.ts`)
- Two in three shops under an upper floor get an awning: striped, dome, or flat steel, one style per building, sized to the shop. That is 711 awnings on seed 7.
- They hang 0.55 m above the shopfront picture, so its sign still shows under the valance.
- Instanced per style and drawn within 260 m (every shop is 6 m wide, so one stretched model serves a style). They cast shade on the shopfronts.

### Rooftops (`src/world/rooftops.ts`, `roof-props.ts`)
- AC units and water tanks are the Blender models within 150 m of the camera: instanced, on the detail layer, a few draw calls for the city.
- Plain stand-ins just inside each model stay merged in the roof trim. They cast the shadows, show in the sea mirror, and are what you see past 150 m.
- Colliders match the models.

### Beach (`src/scenery/beach.ts`)
- The lifeguard towers are the Blender tower, each cabin repainted in its own pastel, merged with the umbrellas per chunk as before.

## Controls
Unchanged. The chase camera sits higher and farther back behind the van, pickup, and SUV.

## Measurements

All on the M4 at 1920x1080, DSF2, Medium, `scripts/perf.mjs` against production builds on `vite preview` (main at 5f71d05 and the branch side by side).

**The machine was busy the whole afternoon.** The owner's Chrome (its GPU process at 30 to 65% CPU) and other work kept the load average between 2 and 19, and every run showed it. In the busy runs, main dropped below 60 in the same scenes as the branch (beach, marina, hillside, at 46 to 59 fps), including scenes this phase does not touch (forest, underwater). So the cleanest evidence is runs taken back to back in the same conditions.

**Interleaved runs, final build** (branch, then main, then the branch again; load 3 to 5). Each cell reads fps / p99 ms / draw calls / CPU ms per frame.

| Scene | branch, run 1 | main | branch, run 2 |
|---|---|---|---|
| spawn | 60 / 16.8 / 469 / 7.88 | 59 / 33.3 / 483 / 11.37 | 60 / 16.8 / 470 / 6.49 |
| downtown | 60 / 16.8 / 480 / 4.83 | 60 / 16.8 / 401 / 4.83 | 59.2 / 33.3 / 490 / 8.6 |
| beach | 55.2 / 50 / 839 / 11.06 | 49.1 / 33.4 / 873 / 11.78 | 53 / 33.4 / 841 / 16.39 |
| canal | 60 / 16.8 / 459 / 4.99 | 60 / 16.8 / 412 / 6.25 | 59.8 / 16.8 / 465 / 6.86 |
| marina | 54.2 / 33.4 / 768 / 15.57 | 50 / 33.4 / 773 / 18.29 | 57.2 / 33.3 / 824 / 15.11 |
| hillside | 57.6 / 33.4 / 737 / 13.21 | 52 / 33.4 / 775 / 17.87 | 54.6 / 33.4 / 737 / 15.61 |
| flyover | 60 / 16.8 / 563 / 5.22 | 60 / 16.8 / 602 / 4.91 | 57.2 / 33.4 / 604 / 14.36 |
| residential | 60 / 16.8 / 419 / 7.93 | 57.8 / 33.4 / 390 / 14.41 | 58.4 / 33.4 / 489 / 13.84 |
| forest | 58 / 33.4 / 510 / 9.98 | 59.2 / 33.3 / 428 / 9.37 | 50.6 / 33.4 / 433 / 11.48 |
| westBeach | 60 / 16.8 / 310 / 4.56 | 60 / 16.8 / 361 / 4.72 | 60 / 16.8 / 269 / 4.88 |
| canalMouth | 60 / 16.8 / 359 / 4.01 | 60 / 16.8 / 267 / 3.98 | 59.6 / 16.8 / 357 / 8.93 |
| boulevard | 60 / 16.8 / 572 / 6.38 | 60 / 16.8 / 514 / 4.79 | 57.8 / 33.3 / 582 / 13.54 |
| oceanDrive | 60 / 16.8 / 516 / 5.43 | 60 / 16.8 / 482 / 5.61 | 56.2 / 33.4 / 511 / 14.44 |
| downtown-night | 60 / 16.8 / 483 / 5.05 | 60 / 16.8 / 450 / 4.91 | 60 / 16.8 / 471 / 9.3 |
| drive (highway loop at 40 m/s) | 55.3 / 33.4 / 3 over 50 ms / 12.15 | 58.8 / 33.3 / 2 / 7.56 | 58.1 / 33.4 / 0 / 12.7 |

- No page errors in any run.
- The branch is on a par with main under the same load: better than main in beach, marina, and hillside in run 1, a little behind in run 2.
- **A quiet start.** One full branch run started at load 1.6 (an earlier build of this branch, the same cars, houses, and rooftops). Its first nine scenes all held 60 fps with p99 16.8 ms and no frame over 50 ms: spawn, downtown, beach, shore, canal, marina, hillside, flyover, and residential. Draw calls were 472, 471, 846, 247, 452, 802, 767, 569, and 419. Then the load rose to 5.7, and the later scenes dropped (forest 51, boulevard 52).
- **The gate** (Medium holds 60 everywhere) could not be shown in one clean full run, because the machine never stayed quiet for the 6 minutes a run takes. What the runs do show: no regression against main in the same conditions, and 60 everywhere in the quiet stretch.

**Draw calls.** The first build added 80 to 150 draw calls a scene. A per-object count (`onBeforeRender` and `onBeforeShadow` hooks) traced most of them to batches that every pass drew, so those were cut:
- Rooftop models now draw on the detail layer, with stand-ins in the trim.
- Distant cars draw opaque.
- Glass and far wheels cast no shadows.
- Furniture and awnings draw near the camera only.

In the interleaved runs the branch is within about -50 to +90 of main per scene: the city scenes run 40 to 80 higher, and northCoast, westBeach, underwater, and forest-hill are lower.

**Loading** (cold, Medium):
- Transferred: 26.6 MB on main, 27.7 MB on the branch (+1.1 MB of the phase's 5 MB). The four Blender cars add 0.57 MB, `houses.glb` 0.36 MB, and the props 0.14 MB. The generated sports and police bodies are still loaded.
- Play to first frame: 2.6 to 2.75 s on the branch, against 2.7 to 3.6 s on main in the same sessions (noise).
- JS heap after the scenes: 362 to 448 MB on the branch, against 374 to 387 MB on main.

## Tests and gates
- `pnpm build`: built (`tsc --noEmit` clean, Vite built).
- `pnpm lint`: clean (`All matched files use Prettier code style!`).
- `pnpm test`: 57 files, 212 tests passed.
  - `vehicle/car-model.test.ts` loads every shipped Blender car glb, bakes it as the game does, and checks body length, height, wheel radius and width against `CAR_SPECS`, and the specs against the glb's extras. The generated bodies keep their size check, and the node-scale bake has its own test.
  - `vehicle/wheel-batch.test.ts` covers the two levels of detail.
  - New `city/plaza-furniture.test.ts`: plaza benches, bins, and kiosks stand inside a plaza, clear of every planter and fountain.
- `pnpm test:e2e`: on the final build, 15 passed (20.8 min).
  - Two earlier full runs, at load 15 to 19, each had two timeouts: the smoke walk and the shooting range in one, the smoke walk and the boat ride in the other. Every one of them passed when run again on its own, and the final run passed whole.

## Known gaps
- **Perf gate under load.** See Measurements: no clean full run was possible on a busy machine. Worth a rerun on a quiet machine before merging.
- **Blender sports car and cruiser not used.** They looked worse than the generated bodies in the game. Since the review, their glbs stay in `assets-src` and no longer ship. To use them later, the Blender scripts need far more shaping (a wedge supercar silhouette, panel detail).
- **Paint.** Fixed in review, see Review fixes.
- **Pop-in.** The Blender street furniture appears at 90 to 220 m and the awnings at 260 m. Past that, those items are not drawn at all; the old procedural ones were drawn everywhere in their chunk. Rooftop units switch from stand-in to model at 150 m.
- **Houses:**
  - Windows are flat dark glass with no rooms behind them and no lights at night (the interior shader needs a per-pane variant).
  - Glass balustrades are drawn opaque.
  - Mirrored houses are drawn double-sided, which costs a little overdraw.
  - The old per-house roof colors are gone: each design has its own roof.
- **Not placed:** the kit's bike, scooter, planter, and cafe set (not in this part's brief; 13e's street clutter can use them). There are only 9 kiosks (plazas without a fountain), none on the promenade.
- **Old assets.** `sports_car.glb` and `police.glb` stay in use; `house-parts.ts` (the procedural houses) is deleted.

## Screenshots (`.planning/phases/013d-screens/`, 1920x1080, Medium, production build)
- **Before and after** (the same cameras on main): `before-car-parked.jpg` and `car-parked.jpg`; `before-residential-street.jpg` and `residential-street.jpg`; `before-residential-aerial.jpg` and `residential-aerial.jpg`; `before-villa.jpg` and `villa.jpg`; `before-shop-awnings.jpg` and `shop-awnings.jpg`; `before-bus-shelter.jpg` and `bus-shelter.jpg`; `before-lifeguard-tower.jpg` and `lifeguard-tower.jpg`.
- **Cars:**
  - `car-parked.jpg` (a Blender van at the curb)
  - `cars-lineup.jpg` (a Blender SUV)
  - `traffic-civilian.jpg` (a pickup in traffic)
  - `traffic-police.jpg` (the kept generated cruiser)
  - `sports-generated.jpg` (the kept generated sports car)
  - `drive-chase.jpg` (driving the van, with the chase camera raised)
- **Houses:** `residential-street.jpg`, `residential-aerial.jpg` (all six designs, pools, mirrored garages), `villa.jpg` (a Spanish villa on its terrace).
- **Props:**
  - `shop-awnings.jpg`, `shop-awnings-2.jpg` (awnings over the shops)
  - `bus-shelter.jpg`
  - `hydrant-bench.jpg`
  - `plaza-kiosk.jpg` (benches, bins, and a kiosk in a plaza)
  - `lifeguard-tower.jpg`
  - `rooftops.jpg` (AC units and tanks)
  - `night-street.jpg` (the awnings at night)

## Review fixes

### Blocker: black and navy paint read blue (fixed)
- **Cause, verified in game:** the sky environment map's specular reflection, on both the base layer and the clear coat. Turning the environment term off on the paint parts alone took a black van from royal blue to black; the diffuse and SSR terms were not involved (SSR is High and Ultra only, and the repro is Medium).
- **Why the 0.7 did nothing:** three.js (r186, `WebGLRenderer`) overwrites `envMapIntensity` with `scene.environmentIntensity` whenever a material uses `scene.environment`, so the material's own value never applied. It is gone.
- **Fix** (`src/vehicle/car-paint.ts`): on the `paint` parts only, the environment reflection is weakened (base 0.55, coat 0.6) and greyed (30% of its color kept). The sky stands in for the street and walls a real car would mirror, so a grey, weaker reflection is closer to life. Other parts (glass, chrome, trim, lamps) are unchanged.
- **Navy** (`car-specs.ts`) is darker and less saturated, from 0x1b2b4a to 0x141b2c. It now reads as navy rather than royal blue; black reads as black or charcoal with a cool sheen on the roof and hood.
- Light paints keep their gloss: white and silver cars look the same as before.
- Screenshots (`013d-screens/`): `review-black-van-suv.jpg` shows a black van and a black SUV at 12:30, Medium; `review-navy-suv.jpg` shows the navy SUV the review flagged (`G.cars()[6]` and `[7]`).

### Non-blocking notes
- **buildCity length** (`src/world/city.ts`): 39 lines, from 43. The night lights now fold into `buildStreets`' per-frame update, and the wind clock into the plants' update.
- **Prop kit off the critical path:** `loadPropKit` now loads while the worker plans the world (`Promise.all` with `planWorld`).
- **Load fallbacks:** a prop file that fails to load (`street_kit`, `awnings`, `lifeguard_tower`) is skipped with a warning, and every consumer goes without those props (beach towers and their colliders included). A failed `houses.glb` warns and leaves the lots empty (drives and fences stay). Checked in game with the three files blocked: the world streams, no page errors, three warnings.
- **Plaza kiosks** (`src/city/plaza-furniture.ts`): the kiosk spot is chosen first, and benches within 4 m of it are skipped (`KIOSK_CLEAR`). `plaza-furniture.test.ts` now checks it, and fails without the fix (a bench 2.97 m from a kiosk). Screenshot: `review-plaza-kiosk.jpg`, the plaza at (-370, 450) from above.
- **Unused car glbs:** `car_sports.glb` and `car_police.glb` no longer ship. `compress-assets.mjs` skips them (`UNSHIPPED`), `check-glb.mjs` leaves them out, and the sources stay in `assets-src`. The deploy is 0.3 MB smaller. Cold transfer is unchanged at 27.7 MB, because the game never requested them.
- **Villas:** `VILLA_DESIGNS` is now modern and Spanish only (both have their own pool), so the procedural stand-in pool in `villas.ts` is gone. Each villa gets a paved drive straight out of its garage from the terrace edge to the road (`houses.ts` `villaDrive`, `hillside.ts` `VILLA_ROAD`). Screenshots: `review-villa.jpg`, `review-villas-aerial.jpg`.
- **Lifeguard tower:** the ramp rails are a little thicker and stand on four posts each (`props_structures.py`), rebuilt in Blender and recompressed. `check-glb.mjs` passes. Screenshot: `review-lifeguard-tower.jpg`.
- **Wheel batches:** `sync` reuses one counts array, and `CarModels.swap` disposes the replaced instanced meshes (instance buffers only; the old geometry may be shared).
- **Neon tube across the shop signs** (from before this phase): the deco ring was at the ground floor's eyebrow height, but the ground floor has shops and no eyebrow. It now runs along the first upper floor's eyebrow (`neon.ts`). Screenshot: `review-night-street.jpg`.
- **Not done:**
  - House windows (flat blue, no interior, dark at night) and the opaque glass balustrades. Both need a per-pane interior variant and a see-through pass, which is more than a cheap fix. They stay in Known gaps.
  - Draw calls are not cut further. The brief's figures stand.

### Gates after the fixes
- `pnpm build`: built.
- `pnpm lint`: clean.
- `pnpm test`: 57 files, 212 tests passed.
- `pnpm test:e2e`: 15 passed (13.8 min), including the phone and touch specs.
- `node assets-src/blender/check-glb.mjs`: every node ok.
- **Perf** (`scripts/perf.mjs`, Medium, 1920x1080, DSF2, production build on `vite preview`): this is the quiet full run the review asked for, at load 1.7 to 2.3.
  - Every scene held 60 fps with p99 16.8 ms and no frame over 50 ms: spawn, downtown, beach, shore, canal, marina, hillside, flyover, residential, forest, forest-hill, northCoast, westBeach, riverMouth, lake, canalMouth, boulevard, oceanDrive, underwater, and downtown-night.
  - The highway drive: 60 fps, p99 16.8 ms, no frames over 50 ms.
  - CPU per frame was 3.3 to 6.3 ms: spawn 4.5, hillside 5.7, beach 6.3.
  - Draw calls: spawn 479, downtown 429, canal 480, residential 419, oceanDrive 522, beach 835, marina 768, hillside 737.
  - Cold transfer 27.7 MB, play to first frame 2.4 s, no page errors.
