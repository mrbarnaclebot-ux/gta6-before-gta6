import * as THREE from 'three'
import { SEA_LEVEL } from '../city/layout'

/*
 * Light under water: anything below the surface loses red first with depth (absorption)
 * and its sunlit side carries animated caustics, the bright net that waves focus onto
 * the seabed. Patched into lit materials: the ground, the seawalls, sea life, the player.
 */

/** Shared by every patched material: the sea clock and how strong the sun's caustics are now. */
export const CAUSTICS = {
  seaTime: { value: 0 },
  causticGain: { value: 1 },
}

/** Declares the sea clock once, however many patches a shader gets. */
export const SEA_TIME_GLSL = /* glsl */ `
#ifndef SEA_TIME
#define SEA_TIME
uniform float seaTime;
#endif
`

export const CAUSTICS_GLSL = /* glsl */ `
vec2 causticHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
// Distance from the nearest cell border of drifting Worley cells: thin bright lines at 0.
float causticCells(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 fr = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = 0.5 + 0.45 * sin(t + 6.2831 * causticHash(i + g));
      float d = length(g + o - fr);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return d2 - d1;
}
// Two warped layers of cells: where their lines cross the light pools brightest.
float seaCaustics(vec2 p, float t) {
  p += 0.25 * sin(p.yx * 2.1 + t * 0.9) + 0.12 * sin(p.yx * 4.3 - t * 1.3);
  float a = causticCells(p * 1.9, t * 1.2);
  float b = causticCells(p * 2.7 + 17.3, t * 0.9 + 2.0);
  float la = 1.0 - smoothstep(0.0, 0.14, a);
  float lb = 1.0 - smoothstep(0.0, 0.11, b);
  // Brightest where the two nets cross, as real caustics pool light at the folds.
  return la * la * 0.7 + lb * lb * 0.45 + la * lb * 1.2;
}
`

const PARS = /* glsl */ `
${SEA_TIME_GLSL}
uniform float causticGain;
${CAUSTICS_GLSL}
`

const LIGHT = /* glsl */ `
#include <lights_fragment_end>
{
  vec3 cw = cameraPosition + (vec4(-vViewPosition, 0.0) * viewMatrix).xyz;
  float under = ${SEA_LEVEL.toFixed(2)} - cw.y;
  if (under > 0.0) {
    // Lines finer than a pixel would shimmer: fade them out with distance.
    float px = length(fwidth(cw.xz));
    float c = seaCaustics(cw.xz, seaTime) * (1.0 - smoothstep(0.05, 0.22, px));
    float k = causticGain * smoothstep(0.0, 0.35, under) * exp(-under * 0.08);
    vec3 absorb = exp(-under * vec3(0.16, 0.05, 0.045));
    reflectedLight.directDiffuse *= absorb * (1.0 + 2.6 * c * k);
    reflectedLight.directSpecular *= absorb;
    reflectedLight.indirectDiffuse *= mix(vec3(1.0), absorb, 0.5);
  }
}
`

/** Adds underwater absorption and caustics to a lit built-in material, after any patch it has. */
export function underwaterLight<T extends THREE.Material>(m: T): T {
  // Parts of one model share a material: patch it once.
  if (m.userData.caustics) return m
  m.userData.caustics = true
  // Read before swapping the hook: the default key is the hook's source text.
  const key = m.customProgramCacheKey()
  const own = m.onBeforeCompile.bind(m)
  m.onBeforeCompile = (shader, renderer) => {
    own(shader, renderer)
    Object.assign(shader.uniforms, CAUSTICS)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PARS)
      .replace('#include <lights_fragment_end>', LIGHT)
  }
  m.customProgramCacheKey = () => `${key}|caustics`
  return m
}

/** Patches every lit material under `root` (the player's figure). */
export function underwaterLightAll(root: THREE.Object3D): void {
  const done = new Set<THREE.Material>()
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
      const lit = 'roughness' in m || (m as THREE.MeshLambertMaterial).isMeshLambertMaterial
      if (lit && !done.has(m)) done.add(underwaterLight(m))
    }
  })
}
