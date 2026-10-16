# render

Renderer, post-processing, shadows, sky, and the day and night cycle.

- `renderer.ts` WebGL renderer; rebuilds the post chain live when a setting needs it
- `graphics.ts` the graphics settings, the Low to Ultra presets, and saving them
- `post-chain.ts` builds the composer: AO, motion blur, depth of field, god rays, bloom, lens flare, AgX, grade, vignette, SMAA, film grain
- `ao-pass.ts` N8AO ambient occlusion per tier
- `motion-blur.ts` camera motion blur effect; `motion-blur-math.ts` its math, mirrored for tests
- `distance-blur.ts` cheap far-field depth of field
- `sun-fx.ts` the sun on screen and its glare: god-ray source disc and lens flare input
- `lens-flare.ts` lens flare effect, occluded by scene depth
- `grade.ts` the color grade baked into a 3D LUT
- `shadows.ts` single follow shadow on Low, cascaded shadow maps (three CSM) above
- `csm-materials.ts`, `csm-shader.ts` set materials up for CSM without breaking their own patches or r186 lighting; all lit programs share one set of CSM uniforms so a rebuilt CSM reaches cached programs
- `height-fog.ts` swaps three's fog for height fog (aerial perspective)
- `view-distance.ts` what each render distance reaches
- `dynamic-res.ts` render scale controller that holds 60 fps
- `sky.ts` sky, image-based light, sun or moon, haze, all driven by the time of day; the night sky loads near dusk
- `ktx2.ts` the shared KTX2 (Basis) loader and the in-place swap of placeholder textures
- `sky-dome.ts` the sky shader: day and night HDRIs blended, sunset glow, sun disk
- `daynight.ts` pure sun path and light levels for an hour of the day
- `sky-analysis.ts` finds the sun and horizon color in an HDRI; ACES curve for fog without post
- `hsv-glsl.ts` GLSL rgb and hsv conversions for shaders that recolor baked textures
- `n8ao.d.ts` types for the ambient occlusion pass
- `card-normals.ts` leaf and grass cards: keep their up-leaning normals on back faces, and draw them matte
- `*.test.ts` checks for the pure parts
- `foliage.ts` wind sway for trees, palms, and ferns, and sunlight through backlit leaves
