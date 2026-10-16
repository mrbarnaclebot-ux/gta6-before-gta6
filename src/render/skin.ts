import type * as THREE from 'three'
import { HSV_GLSL } from './hsv-glsl'

/*
 * People: the generated characters have skin and clothes in one baked map. Skin (found by
 * hue, as life/outfit.ts finds it) gets a softer sheen and light that wraps past the shadow
 * line, reddened as it scatters under the surface; clothes go matte like fabric.
 */

const PARS = /* glsl */ `
${HSV_GLSL}
float skinMask;
`
const MASK = /* glsl */ `
#include <color_fragment>
{
  vec3 skinHsv = rgb2hsv(sqrt(max(diffuseColor.rgb, 0.0)));
  float skinHue = 1.0 - smoothstep(0.06, 0.11, abs(fract(skinHsv.x - 0.06 + 0.5) - 0.5));
  skinMask = skinHue * smoothstep(0.12, 0.2, skinHsv.y) * (1.0 - smoothstep(0.65, 0.8, skinHsv.y))
    * smoothstep(0.15, 0.3, skinHsv.z);
}
`
const ROUGH = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = mix(max(roughnessFactor, 0.82), 0.52, skinMask);
`
const SCATTER = /* glsl */ `
#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
{
  float skinNl = dot(normal, directionalLights[0].direction);
  float skinWrap = max(0.0, (skinNl + 0.45) / 1.45 - max(skinNl, 0.0));
  reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color
    * skinWrap * vec3(0.9, 0.45, 0.34) * 0.32 * skinMask;
}
#endif
`

/** Adds skin and fabric shading to a character material, after any patch it already has. */
export function skinShading<T extends THREE.Material>(m: T): T {
  const own = m.onBeforeCompile.bind(m)
  const key = m.customProgramCacheKey()
  m.onBeforeCompile = (shader, renderer) => {
    own(shader, renderer)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${PARS}`)
      .replace('#include <color_fragment>', MASK)
      .replace('#include <roughnessmap_fragment>', ROUGH)
      .replace('#include <lights_fragment_end>', SCATTER)
  }
  m.customProgramCacheKey = () => `${key}|skin`
  return m
}
