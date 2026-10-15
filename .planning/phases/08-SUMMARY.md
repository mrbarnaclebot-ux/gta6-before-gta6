# Phase 8 summary: cinematic graphics and settings

Status: built and verified on branch `phase-08-cinematic` (from `phase-07-ship`). Not pushed. The Code Reviewer, Designer critique, and audit passes have not run yet. The performance gate is only partly met; see "Performance" below.

## What was built

### Graphics settings (`src/render/graphics.ts`, `src/look.ts`)

- Every option is a field of one plain `Graphics` object. Low, Medium, High, and Ultra are four such objects. Any other mix shows as Custom.
- Settings are saved under `vice.graphics` in localStorage. Saved values are checked key by key, so a stale or hand-edited save cannot break the renderer.
- `?quality=low|medium|high|ultra` picks a preset for one visit (used by the tests and the perf probe).
- `Look.apply` puts a setting into effect live, with no reload. When the effect list changes it rebuilds the composer. Shadows are rebuilt only when the shadow tier or the shadow reach changes; that recompiles the lit materials once, a short hitch. Other rows (bloom, lens flare, and so on) no longer touch the shadows.
- The default preset is **Medium**, which has dynamic resolution on. High could not hold 55 fps at the beach on this M4 while the desktop was also using the GPU. The rule was "High, else Medium".

| | Low | Medium | High | Ultra |
|---|---|---|---|---|
| Shadows | 1 map, 1024, follows the player | CSM 3 x 1024 | CSM 3 x 2048 | CSM 4 x 2048 |
| AO (N8AO) | off | half res, Low | half res, Medium | full res, High |
| Water mirror | 256 | 512 | 768 | 1024 |
| Render distance | Near | Medium | Far | Ultra |
| SMAA, bloom, depth of field | off | on | on | on |
| Motion blur, god rays, lens flare | off | off | on | on |
| Film grain and chromatic aberration | off | off | off | on |
| Dynamic resolution | off | on | off | off |

With every post effect off (Low), the renderer draws straight to the screen and does its own ACES tone mapping. The fog is pre-tone-mapped to match, as it was in Phase 7.

### Shadows (`shadows.ts`, `csm-materials.ts`, `csm-shader.ts`)

- **From Medium up**, three's `CSM` replaces the single follow-shadow.
  - Cascades split in practical mode and fade into each other.
  - They reach the shadow distance set by render distance: 60, 100, 150, or 240 m.
- **Bias:**
  - Depth bias is -0.00004, about 6 cm over the 1400 m light depth.
  - Normal bias is about 1.2 texels per cascade, recomputed from each cascade's footprint. No acne or peter-panning showed in the screenshots.
- **Softness:** PCF filter radius rises per cascade (1.5, 2.5, 3, 3 texels). Shadows are crisp near the camera and softer farther out. This is a cascade-graded look, not true contact hardening (PCSS).
- **Characters and cars** cast and receive shadows; that was already true from earlier phases.
- **Cost cut:** the nearest cascade redraws every frame, and the far cascades take turns every third frame. A skipped map keeps its own matrix, so it stays aligned, just a few frames old. Drawing the shadow maps was most of CSM's measured cost.
- **Three bugs found and fixed:**
  - CSM's bundled copy of three's light chunk is older than r186. It lacks the multi-scattering DFG term, which turned every metal (the glass towers) black once any CSM existed. `csm-shader.ts` splices only CSM's cascade block into the current r186 chunk.
  - CSM's `setupMaterial` overwrote materials' own `onBeforeCompile` (car paint, outfits). `csm-materials.ts` chains the material's own hook first and keeps its program cache key. It also sets up materials added later, such as car bodies loaded after start (it checks every 10 frames).
  - Live shadow changes left every lit material on the old CSM's uniforms. three reuses a cached program, and the uniforms it was compiled with, without calling `onBeforeCompile` again, so a rebuilt CSM never reached the shader: Medium to High kept the 100 m reach, High to Medium sampled the wrong cascades. Now `csm-materials.ts` only sets the CSM defines (which pick the program) and every lit program reads one shared set of CSM uniforms, refilled from the current CSM after each `updateFrustums`. Measured on the dev server over Medium, High, Medium, Low, Ultra, Medium: all 243 lit materials read the right `shadowFar` (100, 150, 100, none, 240, 100) and cascade splits after each switch. `csm-materials.test.ts` covers it.
- Low keeps one 1024 map that follows the player, as in Phase 7.

### Post chain (`post-chain.ts`)

The order is:

1. RenderPass, then N8AO.
2. Motion blur, in its own pass.
3. Depth of field, god rays, bloom, lens flare, ACES, the grade LUT, and the vignette.
4. SMAA.
5. Ultra only: chromatic aberration and grain.

The effects:

- **Motion blur** (`motion-blur.ts`, math in `motion-blur-math.ts`):
  - A custom Effect. It rebuilds each pixel's world position from depth and this frame's inverse view-projection, reprojects it with last frame's view-projection, and blurs along the difference.
  - The blur length is scaled to a 1/80 s shutter, so it looks the same at any frame rate. It is capped at 4% of the screen.
  - A camera jump of more than 8 m counts as a cut and is not blurred.
  - It fades in between 8 and 18 m from the camera, so the player and the driven car stay sharp. Samples that land on nearer surfaces are rejected, so the car does not smear over the road behind it.
  - Strength is 0.3 on foot and rises to full at 30 m/s in a car.
- **Depth of field** (`distance-blur.ts`):
  - Pmndrs `DepthOfFieldEffect` was tried first. It cost about 6 fps at the beach because it uses seven passes with bokeh kernels.
  - It was replaced with a far-field blur in three cheap passes. A half-resolution mask pass keeps only what lies behind the focus, weighted by how blurred it should be. A Kawase blur follows, then a mix by distance. Because of the mask, a sharp subject never bleeds into the background: no halos.
  - Focus follows the camera-to-player distance. While aiming, it moves to whatever is under the crosshair (one Rapier ray per frame), and the blur ramps faster and stronger.
  - The near field is never blurred.
- **God rays:**
  - Pmndrs `GodRaysEffect` streams from a sun disc that is not in the scene. The disc sits along the sun direction and is masked by scene depth, so buildings and palms block it.
  - The disc fades out below the horizon. The effect skips its passes entirely when the sun is set, behind the camera, or underwater.
  - Settings: 32 samples at a third of the resolution, with no extra blur pass.
- **Lens flare** (`lens-flare.ts`):
  - A custom Effect: a halo and five faint ghosts on the line from the sun through the screen center.
  - It is hidden when five depth taps at the sun show anything in front of it, and fades at the screen edges.
  - It was not built on three's `Lensflare` because that copies the framebuffer, which cannot read the composer's half-float buffers. It would also draw inside the water mirror.
- **Grade** (`grade.ts`):
  - A 32-cube LUT baked from one tested function: saturation 1.14, an S-curve contrast, and split toning that cools the shadows toward teal and warms the highlights.
  - It runs after ACES in sRGB. Black and white stay exact.
  - A vignette at 0.4 follows.
- **Height fog** (`height-fog.ts`):
  - Three's fog chunks are swapped globally for exponential height fog. Haze is thickest at sea level and thins over 110 m of height, integrated along the view ray.
  - Distant tower bases fade into the horizon while their tops stay clear, which gives aerial perspective. The water and the underwater surface get it too.
  - Underwater murk stays uniform.
- **Render distance** (`view-distance.ts`): Near, Medium, Far, and Ultra set these together:
  - The camera far plane (700 to 3500 m), which culls whole building chunks.
  - The fog density.
  - The palm detail and fern ranges (0.6x to 1.5x).
  - The parked-car draw range (90 to 220 m).
  - The shadow distance.
- **Textures:** every texture that asked for anisotropic filtering is raised to the GPU maximum (16x on the M4).

### Settings screen (Esc), `src/ui/pause.ts`, `settings-panel.ts`, `settings-rows.ts`, `pause.css`, `settings.css`

- **Layout:**
  - Dark glass panels over the owner's `menu_night.webp`, blurred, with pink and cyan accents. The image is credited in `CREDITS.md` as owner-generated with Higgsfield.
  - Three tabs (Graphics, Display, Controls) following the ARIA tab pattern. Arrow keys switch tabs.
  - Every row has a label and a one-line hint about its cost.
- **Controls** are all real inputs:
  - Segmented choices are radio groups.
  - Toggles are checkboxes with `role="switch"`.
  - Sliders are ranges with an output beside them.
  - Each has a visible cyan focus ring and stays readable at 1080p.
- **Graphics tab:**
  - Preset (picking a preset sets every row below; changing any row makes it Custom).
  - Render scale 50 to 100%, and dynamic resolution, which drops 10% a second when below 55 fps and climbs back 5% at a time.
  - Render distance, shadows, AO, water reflections, SMAA.
  - Depth of field, motion blur, god rays, bloom, lens flare, film grain.
- **Display tab:** field of view (45 to 80 degrees), show FPS, HUD scale (75 to 125%, via CSS `zoom`).
- **Controls tab:** mouse sensitivity, invert Y, and the key list.
- Display and control preferences are each saved under their own `vice.*` key.

### Test hook

`window.__game` gains:

- `graphics()` and `setGraphics(patch)`.
- `setQuality(preset)`, which now takes all four presets.
- `state().quality`, which is a preset name or `'custom'`.
- `state().sun`, the sun direction.

## Controls

Unchanged. Esc opens the settings screen.

## Performance

Setup:

- `node scripts/perf.mjs` against `vite preview` of each build, at 1920x1080 with device scale 2. The game renders at 1x CSS pixels.
- Metal, on the M4, with the before and after runs interleaved.
- The probe now takes any preset. `UNCAPPED=1` turns off vsync, so A/B runs show headroom above 60 fps.
- The desktop Chrome was using the GPU heavily throughout (about 33% CPU in its GPU process). Absolute numbers swung by up to 25% between runs. Compare pairs, not single numbers.

### High vs Phase 7 High

Uncapped, final build, five interleaved pairs, mean fps:

| Scene | Phase 7 | Phase 8 | Change |
|---|---|---|---|
| Spawn | 45.2 | 39.4 | -5.8 |
| Downtown | 54.1 | 48.1 | -6.0 |
| Beach | 40.2 | 33.7 | -6.5 |
| Canal | 50.7 | 44.1 | -6.6 |
| Downtown, night | 54.8 | 49.2 | -5.6 |

Capped (vsync), two interleaved pairs, from the run before the god-ray skip:

| Scene | Phase 7 | Phase 8 |
|---|---|---|
| Spawn | 41.4 | 38.9 |
| Downtown | 47.6 | 43.6 |
| Beach | 36.0 | 32.3 |
| Canal | 47.2 | 35.8 |
| Downtown, night | 51.1 | 41.6 |

**Gate:** uncapped, High is about 6 fps under Phase 7 in every scene (target: about 5). Capped, it is within about 5 fps at spawn, downtown, and beach, and about 10 short at the canal and at night. The canal is the worst case because the water mirror re-renders the scene with CSM shading. **Close, but not fully met.**

Where the remaining cost goes, measured by switching one feature at a time from a lean base in one session at the beach:

- CSM: about 5 fps.
- God rays: about 2 fps.
- Motion blur, depth of field, and lens flare: within noise each.

Fixes made on the way:

- The bokeh DOF went to the masked distance blur (about +6 fps).
- Far cascades update every third frame (about +4).
- The god-ray blur pass was dropped and god rays skip their passes when the sun cannot be seen.
- The High mirror went from 1024 to 768.

### Other presets

Capped, mean of two runs (spawn / downtown / beach / canal / night):

- **Medium** (dynamic resolution on): 58.5 / 60 / 52.9 / 58.1 / 59.9. Holds 60 except at the beach (53).
  - Uncapped, at fixed scale while the controller settles: 54 / 84 / 42 / 74 / 79.
- **Low:** 59.8 / 59.6 / 52.1 / 58.4 / 58.7. It is at or above Phase 7 Low in the same runs (55.4 / 57.4 / 44.3 / 56.4 / 58.6), but the beach is short of 60 on this loaded GPU.
- **Ultra:** about 20 to 24 fps (spawn 20.2, downtown 24.2, beach 20.6, canal 22.8, night 24.4). Ultra is not meant for this GPU at 1080p.

Draw calls at the beach on High: about 400 (Phase 7: 365).

## Verification

- **`pnpm install`:** "Done". No new dependencies; postprocessing and N8AO were already installed.
- **`pnpm build`:** "built in 339ms". The game chunk is 5.47 MB, up from 5.41 MB.
- **`pnpm lint`:** "All matched files use Prettier code style!" A one-off check with `max-lines` 300 and `max-lines-per-function` 40 over every changed file passes.
- **`pnpm test`:** 24 files, 81 tests passed (after the review fixes). New tests:
  - `graphics.test.ts`: presets, Custom detection, saved-value cleaning, `?quality`.
  - `motion-blur-math.test.ts`: shutter scale, clamp, near fade, reprojection for still, moving, and turning cameras.
  - `grade.test.ts`, `height-fog.test.ts`, `dynamic-res.test.ts`.
- **`pnpm test:e2e`:** 5 passed (3.6 min after the review fixes).
  - The pause test now also toggles Bloom (expects Custom, and the setting saved), picks the Low preset, and sets sensitivity on the Controls tab.
  - Load and frame waits now allow 120 s, because the High smoke test compiles the CSM and post shaders on SwiftShader while four other tests render.
  - The `CI=1` smoke subset was not re-run locally this phase.
- **Screenshots** in `.planning/phases/08-screens/`, 1280 px JPGs:
  - `{low,medium,high,ultra}-{beach,downtown,sunset,drive,aim,night}`.
  - `high-*-before` (Phase 7 High, same scenes; there is no sunset shot because Phase 7 has no sun-direction hook).
  - `high-{pause,display,controls}-menu`.
- **What the screenshots show:**
  - The glass towers reflect the sky again after the CSM chunk fix.
  - At sunset, palm shadows reach toward the camera through warm haze.
  - While aiming, the background behind the target is soft and there are no halos around the palms.
  - Fast camera turns blur the buildings while the player stays sharp.
  - At night, god rays are off and the neon blooms.
  - No shadow banding or acne was seen. A slight stair-step can appear where the motion blur meets a curb in a fast turn.

## Known gaps

- **Performance gate:**
  - High is about 6 fps under Phase 7 High uncapped, and up to 10 under capped at the canal and at night.
  - Medium and Low hold 60 everywhere except the beach (about 53) on this shared GPU.
  - Next levers, in order:
    - Lower the CSM cost inside the water mirror pass (for example, mirror materials without shadows).
    - Turn CSM fade off (about +1 fps, not taken because of possible seams).
    - Make High two cascades plus the near one.
- **Not built:**
  - Screen-space reflections: no maintained pmndrs-compatible SSR effect works with three r186. The planar water mirror covers the sea and canal.
  - TAA: pmndrs has none. Temporal stability rests on SMAA, texel-snapped single shadows, and the blur jitter.
  - True contact-hardening (PCSS) shadows.
  - Near-field (foreground) depth of field.
  - Per-object motion blur: only camera motion blurs.
- **Render distance does not cull people or traffic.** They already despawn past 170 m and 260 m, inside even the Near far plane.
- **Water reflection changes rebuild the sea.** Three's `Water` keeps its mirror target private, so a few MB of framebuffer leak per change. This is marked `ponytail:` in `water.ts`. Page load no longer hits it: the sea is first built at the preset's mirror size.
- **The pause dialog changes height between tabs.**
- **Lens flare occlusion** counts anything closer than about 2 km (1.8 km at Far, 2.6 km at Ultra) as blocking the sun; farther towers are lost in the haze anyway.
- **Teleporting after leaving a car** shows a one-second hitch in both builds (first-time shader compiles at the new spot). Phase 7 shows it too.
- **Ultra runs at about 20 fps** on the M4 at 1080p.
- **No paid generation was used.** `menu_night.webp` was generated and paid for by the owner earlier.

## Review fixes

From the Code Reviewer's Phase 8 pass:

- **Blocker, fixed:** stale CSM uniforms after a live graphics change (see Shadows above). Screenshot `high-canal-after-live-switch.jpg` (Medium switched live to High) matches a fresh High load.
- `Look.apply` reconfigures shadows only when the shadow tier or reach changes, so toggling bloom or lens flare no longer rebuilds three shadow maps and relinks about 240 materials.
- The sea is built on the first `setReflection`, at the preset's mirror size; Medium now starts with one 512 mirror (checked in the scene) instead of leaking a 1024 one.
- `?quality=` uses `Object.hasOwn`, so `?quality=toString` falls back to the default (unit test added).
- The aim focus ray reuses one `RAPIER.Ray`.
- The settings dialog fits at 390 px: rows shrink to the width, the tabs wrap and tighten (`phone-settings-graphics.jpg`, `tablet-settings-graphics.jpg`). No horizontal overflow at 390 or 820.
- Lens flare sky test tightened from depth 0.9999 to 0.99999 (about 1 km to about 2 km). The flare still shows over open sky (`high-rooftop-flare.jpg`) and stays hidden behind the skyline at sunset.
- The smoke test comment now says it runs at the Medium default.

Not taken:

- **Periodic `adopt` traversal:** kept. Car bodies are not the only late materials; outfit clones for people spawned later and box-body paints for late traffic also appear, and a lit material missed by CSM setup adds up the light of every cascade. The traversal costs little every 10 frames.
- **Sharpening car body textures:** not needed. The glb body textures never ask for anisotropic filtering (anisotropy 1), so the "every texture that asked" rule already holds for them.
- **Performance gate:** unchanged; still needs the owner's call (accept High at about 6 fps under Phase 7, or take the next lever: no CSM in the mirror pass, or 2+1 cascades on High).
- **Content realism** (box towers, empty sand, sparse street props, stiff swim pose, dark dusk away from the sun): out of this phase's renderer scope.
