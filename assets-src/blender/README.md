# assets-src/blender

The game's own model library, built by headless Blender Python scripts: six cars, six houses, three shop awnings, a lifeguard tower, and a street kit. Nothing is hand-modelled or downloaded; every mesh, material, and texture comes from these scripts, so the whole library rebuilds byte for byte.

## Rebuild everything

From the repo root:

```sh
bash assets-src/blender/build.sh
```

It runs `cars.py`, `houses.py`, and `props.py` in Blender (`-b --factory-startup`), writes the GLBs to `assets-src/models/...` and the previews to `previews/`, runs `node scripts/compress-assets.mjs models` (Meshopt, WebP textures) into `public/assets/models/...`, and finishes with `node assets-src/blender/check-glb.mjs`, which fails if any top-level node changed size (by more than 1 cm) or triangle count in compression. About three minutes on the M4. Set `BLENDER` to use another Blender binary (built and checked with Blender 5.4 Alpha). One family alone: `Blender -b --factory-startup -P assets-src/blender/cars.py -- sports police` (cars only take names; houses and props always write whole files).

The GLBs come out identical on every run; only the preview PNGs change (render noise), so revert those unless the model changed.

## Files

- `cars.py` entry for the cars: materials, node tree, export, previews. `car_specs.py` every car's measurements; `car_body.py` the lofted shell, wheel arches, arch lips; `car_details.py` lamps, grille, plates, handles, mirrors, exhausts, light bar, lettering; `car_interior.py` seats, dash, tub, headliner, pickup bed; `car_wheels.py` tyre and rims
- `houses.py` entry for the houses; `house_designs_a.py` ranch, Mediterranean, modern; `house_designs_b.py` deco, Key West, Spanish; `house_parts.py` windows, doors, garage doors, walls, columns; `house_roofs.py` hip, gable, shed and flat roofs, pools, decks, railings, garden walls, picket fences, steps
- `props.py` entry for the props; `props_street.py` bench, bin, hydrant, planter, cafe set, AC unit, water tank; `props_vehicles.py` bike, scooter; `props_structures.py` awnings, kiosk, bus shelter, lifeguard tower
- `lib/` shared helpers (see `lib/README.md`); `previews/` one PNG per asset; `build.sh`, `check-glb.mjs` as above

## Conventions (all assets)

- Metres, glTF +Y up. Axes as in the game: x left, y up, z forward. The scripts build in these axes and convert to Blender's only when making objects (`lib/scene.py` `G2B`), so the exporter's +Y-up switch lands back on them.
- Every asset is a top-level node (an empty) named after it, with its meshes as children. LOD1, where there is one, is a sibling root with the suffix `_lod1` at the same origin.
- Materials are Principled BSDF only (base colour, metallic, roughness, normal, emission, clear coat, alpha). The few textures are computed with numpy in `lib/textures.py` (Blender procedural nodes do not export), 512 px or less, shared inside a file.
- Every node's transform survives compression (checked by `check-glb.mjs`). As in Phase 11: Meshopt moves scale onto nodes, so code that takes `mesh.geometry` alone must apply the node's world matrix first (as `findMesh` in `src/vehicle/car-model.ts` does).

## Cars: `models/vehicle/car_<name>.glb`

Origin on the ground midway between the axles; nose towards +z, the car's left at +x. Nodes under the root `<name>` (and `<name>_lod1`, with `_lod1` on every child name):

| node | what | materials |
|---|---|---|
| `body` | shell with arches, lips, grille, plates, handles, mirrors, exhausts, light bar, push bar, lettering | `paint`, `paint_white` (police doors and roof), `trim_black`, `chrome`, `grille`, `well`, `plate`, `lightbar_red`, `lightbar_blue`, `bedliner` (pickup) |
| `glass` | every window, one mesh | `glass` |
| `lights_head` | headlamp lenses and bezels, amber indicators | `light_head`, `light_indicator`, `trim_black` |
| `lights_tail` | tail lamps, reversing lamps, light bar across the boot | `light_tail`, `light_reverse`, `trim_black` |
| `interior` | tub, seats, dash, steering wheel, headliner (van: closed cargo box) | `interior`, `trim_black` |
| `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr` | tyre, rim, brake disc; one shared mesh | `tyre`, `rim`, `brake`, `chrome` |

| car | LOD0 / LOD1 tris | body l x w | size with mirrors (w x h x l) | wheel r / width | wheel x | axles z | rim |
|---|---|---|---|---|---|---|---|
| sports | 22,474 / 5,160 | 4.60 x 2.06 | 2.39 x 1.24 x 4.65 | 0.34 / 0.28 | 0.88 | +-1.265 | twin 5-spoke, gunmetal |
| police | 24,676 / 5,590 | 5.00 x 1.92 | 2.23 x 1.58 x 5.12 | 0.36 / 0.25 | 0.80 | +-1.4375 | black steel, chrome cap |
| sedan | 23,020 / 5,060 | 4.85 x 1.84 | 2.15 x 1.44 x 4.91 | 0.335 / 0.225 | 0.79 | +-1.41 | 5-spoke silver |
| suv | 22,790 / 5,174 | 4.85 x 1.93 | 2.23 x 1.81 x 4.91 | 0.375 / 0.255 | 0.84 | +-1.425 | 6-spoke silver |
| pickup | 23,746 / 5,230 | 5.60 x 2.00 | 2.29 x 1.88 x 5.66 | 0.40 / 0.27 | 0.86 | +-1.75 | 6-spoke silver |
| van | 24,048 / 4,868 | 5.30 x 2.00 | 2.31 x 2.21 x 5.36 | 0.355 / 0.235 | 0.87 | +-1.65 | steel, chrome cap |

The body runs from `front` to `rear` in `car_specs.py` (sports +2.365 / -2.235, police +2.4875 / -2.5125, sedan +2.47 / -2.38, SUV +2.375 / -2.475, pickup +2.75 / -2.85, van +2.55 / -2.75); exhausts and the police push bar stick out a little past it. The root's glTF extras repeat the wheel numbers (`wheel_radius`, `wheel_width`, `wheel_x`, `wheel_front`, `wheel_rear`) and a driver hip point (`seat`, metres, car space).

Integration notes:

- **Same sizes as today.** The sports car and the police car keep `CAR_SPECS`'s length, wheelbase, wheel radius and width, and where the wheels sit along the body (front wheel 1.2 m / 1.45 m from the body's middle). The sports car keeps wheel x 0.88; the police wheels move out from x 0.74 to 0.80 so the tyres fill the arches of a 1.92 m wide body. The new GLBs are in metres with the origin between the axles, so `bodyScale` and `narrow` go away: the specs become plain metres, and the body's middle sits `(front + rear) / 2` from the origin.
- **Swap, not shader.** `car-paint.ts` finds paint, glass, and lamps by colour in one baked texture; these cars name them instead. Recolour by setting `paint`'s colour (it carries a clear coat, so three makes it a `MeshPhysicalMaterial`); the police keeps `paint` black and `paint_white` white. Lamps: `light_head` and `light_tail` ship with a low emissive (0.2 and 0.15, daytime lenses); scale `emissiveIntensity` for headlights and brakes. `lightbar_red` / `lightbar_blue` are full emissive, to pulse.
- **Glass** is `alphaMode: BLEND`, alpha 0.72, double-sided, dark tint, so the interior shows. If the game keeps its opaque mirror glass (`reflectiveOut`), set `transparent = false` on `glass` and the interior simply stops showing.
- **Wheels.** `wheel_fl` holds the mesh; the other three are instances, the right-hand ones turned 180 degrees about y so the rim faces out. That is the layout `wheel-batch.ts` already expects: axle along x, rim face towards +x, origin at the hub. Take one wheel's primitives (tyre, rim, disc) for the instanced batch and the four node positions as the hubs. There is no brake caliper because it would spin with the wheel node.
- **LOD1** has no shut lines, handles, exhausts, or interior detail, a 24-sided arch cut and 18-sided wheels; switch at around 60 to 80 m.
- Phase 13d loads the sedan, SUV, pickup, and van. The sports car and police cruiser kept their generated bodies (`sports_car.glb`, `police.glb`): side by side in the game they looked more detailed than these two (see `.planning/phases/013d-SUMMARY.md`). `car_sports.glb` and `car_police.glb` stay in `assets-src` but do not ship: `compress-assets.mjs` skips them (`UNSHIPPED`) and `check-glb.mjs` leaves them out.

## Houses: `models/houses/houses.glb`

One file, so all six share their materials and textures. Roots `house_<name>` and `house_<name>_lod1`, each with one mesh child `<root>_mesh`. Origin at the ground centre of the main block; front (door, garage) towards +z; doors open at floor level, y 0.15 (0.6 for the raised Key West house); walls and a plinth band go down to y -0.6 so a sloping pad never shows a gap (the game sinks houses 0.8 m). The garage door is centred at x = w / 2 - 2.2, where `buildHouses` runs the driveway for `garage = 1`; for `garage = -1` mirror the house (scale x -1; three flips the winding itself).

| house | main block w x d, floors | bounds w x h x d | LOD0 / LOD1 tris | look |
|---|---|---|---|---|
| `house_ranch` | 14 x 10, 1 | 15.3 x 6.5 x 13.2 | 1,436 / 260 | cream stucco, clay tile hip roof, column porch, teal shutters |
| `house_mediterranean` | 13 x 10, 2 | 14.2 x 9.3 x 12.2 | 2,935 / 397 | sand stucco, tile hip roofs, entry tower, arched windows, balustraded balcony |
| `house_modern` | 13 x 11, 2 | 13.2 x 7.4 x 16.6 | 1,226 / 338 | white boxes, cantilevered upper floor, glass walls, wood slats, raised deck and pool behind |
| `house_deco` | 12 x 10, 1 | 13.3 x 6.6 x 16.8 | 1,300 / 202 | mint art deco, parapet, fin, eyebrows, porthole, glass blocks, front garden wall |
| `house_keywest` | 12 x 9, 1 | 13.0 x 7.6 x 15.5 | 2,572 / 316 | yellow, raised floor, standing-seam metal gable, deep porch, shutters, picket fence |
| `house_spanish` | 14 x 11, 2 | 14.8 x 9.0 x 23.3 | 4,195 / 545 | coral, two-storey tile block, garage wing with roof terrace, pool behind, garden wall |

Bounds include the roof overhang, the plinth below ground, front garden walls (6 m in front of the front wall, 2 m inside the curb), and back decks and pools (inside the 11 m back yard that `buildHouses` fences).

Integration notes:

- **Lots.** `residential.ts` makes lots 11 to 14 m wide and 9 to 11 m deep. Pick the design nearest the lot (or by `tint`/`roof` as today) and either scale x and z by the small difference or use the model's own footprint for the collider; the `extras` on each root give `width`, `depth`, `floors`, `garage_x`.
- **Materials.** `stucco_<colour>` (cream, sand, white, grey, mint, yellow, coral) share one stucco normal map, so they can all be swapped for the game's `white_stucco` set with a tint. `roof_tile` (colour and normal, clay barrel tiles in 2 m tiles with u along the eaves) and `roof_metal` (standing seams) are textured; `roof_ridge`, `trim`, `plinth`, `frame_dark`, `door`, `door_panel`, `brass`, `garage_door`, `seam`, `shutter`, `concrete`, `pool_water`, `pool_tile`, `rail_metal`, `glass_rail` (alpha), `fence`, `wood`, `glass_block`, `roof_flat` are flat.
- **Windows** are framed dark glass (`glass_house`) set behind proud surrounds, so nothing is cut out of the walls. Every pane is a single quad with its own 0 to 1 UV square, ready for an interior-mapping shader like `src/world/interior.ts` (which today keys off facade grid cells, so it needs a per-pane variant to fit).
- **Pools** sit on raised 0.3 m decks, because the yard is the game's own terrain: a basin below ground level would be covered by it.
- **LOD1** keeps walls, roofs, porches, and pools, and turns each window into a glass quad; switch at around 100 m.

## Props

Each prop is a root `<name>` with one mesh child `<name>_mesh`. Standing props: origin on the ground at the centre, front (the side you use) towards +z.

| file | node | size w x h x d (m) | tris |
|---|---|---|---|
| `props/street_kit.glb` | `bench` | 1.80 x 0.92 x 0.65 | 412 |
| | `bin` | 0.60 x 0.97 x 0.62 | 428 |
| | `hydrant` | 0.34 x 0.82 x 0.34 | 532 |
| | `planter` (with a small fan palm) | 1.47 x 1.58 x 1.48 | 160 |
| | `cafe_set` (table, two chairs, umbrella) | 2.50 x 2.53 x 2.50 | 616 |
| | `ac_unit` (on a 6 cm pad that sinks into its base) | 0.90 x 0.79 x 0.90 | 364 |
| | `water_tank` (rooftop, on a stand, ladder at +z) | 2.10 x 4.50 x 2.15 | 1,076 |
| | `bike` (upright, centred between the axles) | 0.61 x 1.06 x 1.73 | 1,416 |
| | `scooter` (on its stand) | 0.69 x 1.26 x 1.64 | 1,456 |
| | `kiosk` (hatch and awning at +z) | 2.40 x 2.52 x 2.80 | 220 |
| | `bus_shelter` (open side at +z, advert panel at +x) | 3.80 x 2.59 x 1.60 | 200 |
| `props/awnings.glb` | `awning_striped` (red and white canvas, scalloped valance) | 3.00 x 0.91 x 1.10 | 162 |
| | `awning_dome` (navy barrel awning) | 2.62 x 1.08 x 1.02 | 302 |
| | `awning_flat` (steel canopy, tie rods, two downlights) | 3.20 x 1.03 x 1.31 | 148 |
| `props/lifeguard_tower.glb` | `lifeguard_tower` | 3.20 x 6.20 x 6.82 | 537 |

- **Awnings hang on walls:** origin at the middle of the top mounting edge on the wall face (y 0 there), reaching out towards +z and down. Mount them about 2.6 m up a shopfront; the striped one is 3 m wide (`awning_striped(w, ...)` in the script makes other widths).
- **Lifeguard tower:** cabin front (+z) faces the sea, the ramp runs down the back to -z (it ends 5.2 m behind the origin), and the stilts go 0.5 m into the sand.
- Emissive props: `ad` (bus shelter and kiosk light boxes, 0.5) and `lamp_warm` (canopy downlights); `light_head` / `light_tail` on the scooter. The advert faces are plain white light boxes; the sign atlas (`signs.ktx2`) can be mapped onto them.
- Canvas, leaves, glass panels, and the flag are double-sided single faces.

## Previews

`previews/car_<name>.png` and `previews/house_<name>.png` show three views side by side (front three-quarter, rear three-quarter, LOD1); `previews/prop_<name>.png` one front three-quarter view (awnings on a stand-in wall). All are Eevee renders under the game's day HDRI with a low sun.

## Blender 5.4 Alpha notes

- The glTF exporter behaved: clear coat (`KHR_materials_clearcoat`), emissive, `BLEND` alpha, double-sided flags, shared meshes (one wheel mesh, four nodes), node rotations, and root extras all come through, and the output is byte-identical between runs.
- Workbench is not offered as a render engine in this build (only Eevee), so previews use Eevee.
- `bpy.ops.object.join` needs a `temp_override` with the target active in background mode; booleans are applied through `bpy.data.meshes.new_from_object` on the evaluated object instead of `modifier_apply`, which needs no UI context.
- Procedural shader nodes do not export, so the stucco, tile, and seam textures are computed in numpy and packed into the file as images (WebP after compression).
