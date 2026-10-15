import * as THREE from 'three'
import { HSV_GLSL } from '../render/hsv-glsl'

// Hue turn and brightness for each outfit; the first keeps the generated clothes.
export const DYES: [hue: number, value: number][] = [
  [0, 1],
  [0.45, 0.95],
  [0.25, 0.9],
  [0.62, 1],
  [0.8, 0.85],
  [0.12, 1],
]

// Skin, lips, and wood-brown hair sit near this hue; clothes elsewhere get dyed.
const DYE = /* glsl */ `
  vec3 hsv = rgb2hsv(sqrt(diffuseColor.rgb));
  float skin = 1.0 - smoothstep(0.07, 0.13, abs(fract(hsv.x - 0.06 + 0.5) - 0.5));
  float cloth = smoothstep(0.12, 0.3, hsv.y) * (1.0 - skin);
  vec3 dyed = hsv2rgb(vec3(fract(hsv.x + uDye.x), hsv.y, hsv.z * uDye.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, dyed * dyed, cloth);`

/**
 * A copy of a generated person's material with the clothes recolored, so one shirt
 * texture dresses a whole crowd. Skin tones, whites, grays, and blacks are left alone.
 */
export function outfit(base: THREE.Material, dye: number): THREE.Material {
  const mat = (base as THREE.MeshStandardMaterial).clone()
  const [hue, value] = DYES[dye % DYES.length]
  mat.customProgramCacheKey = () => 'outfit'
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDye = { value: new THREE.Vector2(hue, value) }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec2 uDye;\n${HSV_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>${DYE}`)
  }
  return mat
}
