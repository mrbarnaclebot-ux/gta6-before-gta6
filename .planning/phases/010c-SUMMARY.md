# Phase 10c summary: ocean, shore foam, and sea life

Status: built and verified on branch `phase-10c-ocean` (from `phase-10b-vegetation`). Not pushed. Code Reviewer and Designer passes ran; their blockers are fixed (see Review fixes).

## What was built

All new code lives in `src/sea/` (see its README). `world/water.ts` and `world/underwater.ts` were rewritten on top of it.

### Waves (`sea/waves.ts`, `sea/field.ts`, `sea/sea-glsl.ts`, `sea/sea-grid.ts`)

- **Four summed Gerstner swells** from the east, toward the beach (46, 27, 15, and 8.5 m long), with deep-water dispersion.
- **A surf wave** that rolls in parallel to the shore. Its phase follows the baked shore distance plus a small along-shore wobble, so crest lines break up instead of running ruler-straight.
- **One source of truth:** `waveHeightAt(x, z, t, at)` in pure TypeScript. Gerstner moves points sideways, so it inverts that with five fixed-point steps (within 1 mm of the drawn vertex). The GLSL is generated from the same constants, so the shader and the physics cannot drift apart.
- **The sea field:** a bake per 2 m texel of:
  - depth at rest
  - signed distance to the shore (two-pass chamfer)
  - wave scale
  
  It takes about 1 M texels, from the canal east to the edge of the map. The shaders read it as a half-float texture and swimming reads the same arrays.
- **Wave scale:**
  - About 0.2 at the waterline, rising to 1 by 3 m of depth. The surf also shrinks with it, so only a gentle swash runs up the sand.
  - 0.15 in the walled canal.
  - There is no marina in the map, so nothing is scaled there.
- **Camera-following grid:** 320 x 320 lines with sinh spacing, about 0.5 m apart under the camera and 5 m apart at 100 m, out to 20 km.
  - It moves in whole grid steps, so near vertices never swim.
  - Each wave fades out between 2.5 and 5 of its own wavelengths from the camera, before the grid gets too coarse for it. The normal map carries detail past that.
  - `waveHeightAt` is the unfaded sea. Ripples under 15 m long are only drawn within about 40 to 75 m; past that the drawn surface is smoother than the physics.
- **Planar reflection:** three's `Water` mirror is kept. The vertex shader displaces the grid, and the fragment shader adds the wave slope to the normal-map slope. The mirror plane stays at sea level.
- **Swimming uses the waves:** `city.water(x, z)` is now the live wavy surface. The swimmer bobs with the swell and the shallows lap.

### Shore foam (`sea/water-shader.ts`, `sea/foam-texture.ts`, `scenery/terrain-material.ts`)

- **Foam texture:** a procedural tileable lace (cell-border strands plus small bubbles), 256 px, generated at load. No CC0 foam texture was in the asset set; this one costs no download.
- **Breakers:** the surf crest turns white where the water is under about 2.6 m deep. It leaves a short trail that breaks up into lace as it falls behind the crest.
- **Sets:** each crest breaks only in stretches along the shore, with green water between, from two low-frequency along-shore sines frayed by the foam texture. The crest's index shifts the pattern, so each crest keeps its gaps as it rolls in and the next one breaks in different places.
- **Lapping edge:** the thinner the water, the more of the lace shows. Solid at the waterline, holes a few centimeters deeper, gone by 7 cm. It follows the moving edge of the swash.
- **Walls and rocks:** where deep water meets land within about 1.6 m (the canal seawalls, and the new surf rocks), the swell foams white.
- **Whitecaps:** sparse foam on the highest offshore crests, only in water over 4 m deep.
- **Foam lighting:** foam is lit by the sky's reflection and the sun's color, so it turns warm and dim at sunset instead of staying paper white.
- **Wet sand:** the terrain shader evaluates the same waves at the sand. It darkens sand the swash covers now or covered in the last 3 s, so the wet band follows the waves and dries behind them. Sand within 30 cm above still water stays damp.
- **Clarity:** follows the optical path, depth over the view angle's sine. The reef is visible from above in clear turquoise water, and grazing and far water goes opaque.

### Underwater (`sea/caustics.ts`, `sea/shafts.ts`, `sea/motes.ts`, `world/underwater.ts`, `render/sky.ts`)

- **Caustics:** two warped, drifting Worley-cell nets, brightest where they cross. They are patched into the lit materials (`underwaterLight`):
  - the terrain, both seen from above through shallow water and from below
  - rocks, corals, plants, fish, and rays
  - the player's figure
  
  They only appear on sunlit surfaces: they multiply the direct sunlight term, so shadows stay dark. They fade out with distance before the lines alias.
- **Absorption:** below the surface, direct light loses red first with depth, then green.
- **Light shafts:** additive ribbons hanging from the surface along the refracted sun direction. Each faces the camera around its own axis, sits on a world-fixed lattice (parallax when you swim), and pulses slowly. They fade with depth and sun height.
- **Motes:** 1,400 drifting specks in a world-fixed box that wraps around the camera.
- **Fog:** blue-green near the surface. It darkens toward blue and thickens with the camera's depth.
- **Surface from below:**
  - the same wave grid, displaced
  - each view ray is refracted through the rippled wavy surface into a sky gradient with a sun glint, inside Snell's window
  - a bright rim at the window's edge, and the dim water mirrored past it (total internal reflection)
  - the "under the surface" test now uses the wave height at the camera
- **Visibility:** the reflective top is still hidden while under, which skips its mirror.

### Sea life (`sea/reef-plan.ts`, `sea/boids.ts`, `sea/fish*.ts`, `sea/seabed-models.ts`, `sea/rays.ts`, `sea/sea-life.ts`)

- **Seeded plan:** a reef patch every 150 m along the coast, 3.8 to 5.2 m deep (15 reefs). Each has:
  - about 48 corals in four procedural kinds, each tinted from a seven-color palette:
    - brain dome
    - staghorn
    - sea fan
    - tube sponges
  - about 26 kelp clumps (three twisting ribbons each)
  - 12 mossy rocks (the Poly Haven rock_moss_set_01 already in the assets). They collide (Rapier balls sunk into the sand), so a diver lands on them. Corals and plants do not collide.
  - a seagrass meadow of about 380 clumps inshore, 0.9 to 4.5 m deep
  
  Plant heights are capped so tips stay under the wave troughs. Kelp and grass sway in the vertex shader, and dither away within about 1.6 m of the camera, so the camera passing through a clump never fills the frame with a blade.
- **Surf rocks:** about half the stretches get a cluster of four rocks just off the waterline, tops above water. They collide (Rapier cylinders) and are stamped into the sea field, so the surf foams around them.
- **Fish:** two schools per reef, 28 schools and about 750 fish in one instanced mesh:
  - silver baitfish, 40 per school
  - yellow grunts or blue tangs, 12 to 14 per school
  
  The fish is procedural: a flattened lathe body with forked tail and dorsal fins, a dark back and silver belly, shiny PBR. The tail beats in the vertex shader, each fish out of step.
- **Boids:** cohesion, alignment, and separation, plus:
  - a pull back to the reef
  - the seabed and the surface as soft walls, and never below the seabed. The surface wall sits 0.6 of the largest wave below still water, so a school never breaks a trough.
  - a panic: within 5 m of the swimmer the school flees and scatters (cohesion drops), then regroups as the panic fades over about 3 s
  
  Only schools within 120 m of the camera are simulated. The others are hidden (zero-scale matrices).
- **Eagle rays:** seven procedural rays, a diamond with a whip tail and flapping wings, glide slow banked loops over every other reef. No CC0 ray or turtle model was in the asset set. Turtles were skipped.
- **Culling:**
  - All sea life is on the detail layer, so the water's mirror and the sun's shadow map skip it.
  - The whole group is hidden when the camera is over 320 m from every reef.
  - Seabed meshes are chunked at 250 m for frustum culling.

## Controls

Unchanged. Swimming feels the swell: the swimmer rises and falls with it.

## Verification

### Gates

- **`pnpm install`:** works. No new dependencies.
- **`pnpm build`:** passes.
- **`pnpm lint`:** passes (eslint and prettier). Every source file is under 300 lines and every function under 40.
- **`pnpm test`:** 31 files, 112 tests pass. New:
  - `src/sea/waves.test.ts`:
    - `waveHeightAt` lands on the displaced vertex
    - the height stays bounded and moves over time
    - the canal is calmer
    - the surf averages to still water
    - the field's signed shore distance and shallow-water scale
  - `src/sea/boids.test.ts`:
    - a school stays together, aligned, near home, and off the seabed
    - it scatters from a swimmer, then regroups
- **`pnpm test:e2e`:** 8 passed in 6.2 min (after the review fixes).
  - The swim test now also teleports to a reef. It checks that the water height moves by more than 1 cm with the waves, that a fish school is swimming, and that each school's lead fish is above the local seabed (`__game.ground`).
  - The floating check allows 1.2 m of slack for the swell.

### Performance (`scripts/perf.mjs`, 1920x1080 at DSF2, Apple M4, Chrome on Metal)

New probe scenes:

- `shore`: from the beach out over the surf.
- `underwater`: on the reef nearest the beach, holding dive.

| Scene | Medium fps / draws | High fps / draws | Ultra fps / draws |
|---|---|---|---|
| spawn | 60 / 511 | 60 / 523 | 29.4 / 472 |
| beach | 60 / 910 | 46.9 / 1094 | 24.6 / 1096 |
| shore | 60 / 177 | 60 / 181 | 38.4 / 267 |
| canal | 60.1 / 419 | 60 / 490 | 28 / 433 |
| underwater | 60 / 105 | 60 / 149 | 43 / 107 |

- **Medium holds 60** in every scene, beach and underwater included. Dynamic resolution is on, as always.
- **High:** the beach view is 46.9; it was 37.4 in 10b. Everything else is 60.
- **Ultra:** stays GPU-bound around 25 to 43 fps, as in 10b. It was not tuned.
- **Load and download:** play to first frames was 3.4 s (3.2 s in 10b): the sea field bake and the procedural meshes. The download is 47.1 MB, unchanged; every new asset is procedural.

### Screenshots (`.planning/phases/010c-screens/`)

Dev build, Medium, headless Chrome on the Metal GPU, 1920x1080.

- **Shoreline foam:**
  - `day-shore-foam`: a breaker rolling in, lacy foam at the edge, caustics in the shallows
  - `day-shore-wide`
  - `sunset-shore-foam`, `sunset-shore-wide`: 17:24
- **From above:** `day-reef-from-above` (the reef through clear water), `day-canal-walls` (the calm canal).
- **Underwater:**
  - `underwater-caustics-fish`: caustics on the sand and rocks, a blue tang school, light shafts
  - `underwater-reef`: corals, kelp, a baitfish school
  - `underwater-surface-from-below`: Snell's window through the rippled surface

### What I tuned from the screenshots

- **Foam:** the edge foam first covered a 20 m band of water lying over the sand. The cause was a wall-foam term that fired on negative shore distance; it now needs deep water against land. The foam was also cotton-ball blobs; it is now cell-border lace with holes.
- **Wet sand:** at roughness 0.35 it mirrored the sky into a white band. It is now 0.6 and darker.
- **Water clarity:** the reef was invisible from above. Clarity now follows the optical path.
- **Plant tips:** seagrass and kelp poked out of the troughs; their heights are capped.
- **Corals:** every coral got the same tint (a palette index bug).
- **Caustics:** made finer and organic, where they had looked like cracked mud.
- **Underwater color:** the fog brightened toward teal, and red absorption halved, so corals keep some color at 5 m.

## Known gaps

- **The surf is one shore-parallel wave.** It does not refract around the headlands or curl over; breaking is foam on a peaked crest, not a plunging lip.
- **Reflections:** the planar mirror reflects the flat sea plane, not the displaced surface. With gentle swells it reads right; steep waves would need screen-space reflections.
- **Foam around piers:** around the highway piers it was not added. None stand in the sea, and the canal bridges are decks without piers.
- **Fish models:** procedural low-poly fish and rays, flat-colored. A CC0 rigged fish set (Quaternius) would look better; no paid generation was used. There are no turtles.
- **Distant sea life:** schools beyond 120 m are hidden, not frozen. From the beach you will not see distant fish, which is fine at those distances in the fog.
- **Underwater view:** there is no screen-space distortion of the whole view. The refraction is only in Snell's window on the surface sheet. A half-in, half-out camera shows no split waterline.
- **Wet sand at the waterline:** the waterline itself and wet-sand foam remnants (bubbles left on the sand as the swash recedes) are not drawn; only the darkening is.
- **Mirror memory:** the `Water` mirror target still leaks a few MB per reflection-quality change (existing ponytail note).
- **Paid tools:** no AssetHub, Higgsfield, or fal credits were spent. No new downloaded assets: foam, fish, rays, corals, kelp, and seagrass are all procedural; the rocks reuse the Poly Haven rock set already credited.
- **Process:** the audit pass is still to run.

## Review fixes

- **Reef boulders collide (blocker).** Every reef rock now gets a Rapier ball, `0.45 s` radius at `0.3 s` above its base, like the surf rocks' cylinders. Probe: 42 dives onto a 6 x 7 grid over reef 0; two landed on boulders 1.08 m and 0.65 m above the sand, one slid 0.31 m off a boulder's flank, the rest reached the sand. `underwater-standing-on-boulder.jpg`, `mobile-underwater-reef.jpg` (the reviewer's repro spot: the swimmer stays in front of the boulder).
- **Breakers in sets (Designer).** See Sets above. `day-shore-breaker-sets.jpg`.
- **Camera in kelp (Designer).** Near-camera dither fade on `swayMaterial`: a screen-space hash discards fragments when view depth is under 0.6 to 1.6 m. `underwater-camera-in-kelp.jpg` has the camera inside a kelp clump with no blade in frame.
- **Cheap notes taken:** the e2e water-motion and fish checks are stronger; the fish surface wall is lowered; the caustics comment no longer claims the seawalls; `instanceParts` takes any `Object3D` parent, which drops the `as unknown as THREE.Scene` cast; the reef count is 15.
- **Not taken:** the field bake's per-texel rock search, packing awake fish into `mesh.count`, and the per-query wave allocations. The heap is flat and Medium holds 60, so they wait for a measured need. The pre-existing sunset direction and TERMS link color are outside 10c.
