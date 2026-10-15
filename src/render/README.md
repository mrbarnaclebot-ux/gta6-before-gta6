# render

Renderer, post-processing, sky, and the day and night cycle.

- `renderer.ts` WebGL renderer and the High (AO, bloom, SMAA) and Low pipelines
- `sky.ts` sky, image-based light, sun or moon, haze, all driven by the time of day
- `sky-dome.ts` the sky shader: day and night HDRIs blended, sunset glow, sun disk
- `daynight.ts` pure sun path and light levels for an hour of the day
- `sky-analysis.ts` finds the sun and horizon color in an HDRI; ACES curve for Low fog
- `ao-pass.ts` the ambient occlusion pass and its settings
- `n8ao.d.ts` types for the ambient occlusion pass
- `*.test.ts` checks for the pure parts
- `hsv-glsl.ts` GLSL rgb and hsv conversions for shaders that recolor baked textures
