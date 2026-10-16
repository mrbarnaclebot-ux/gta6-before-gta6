import type * as THREE from 'three'

/*
 * Wind and backlight for plants. Every plant model is normalized to 1 m tall before its
 * instance scale (world/instancing.ts), so local height is 0 at the root and 1 at the top:
 * the sway grows with height squared, so trunks bend from the ground and the crown moves most,
 * and leaves far from the trunk flutter on top of it. The trunk and leaves of one tree get the
 * same sway from the same root, so they never part. Translucent leaves pass sunlight through
 * when the eye looks toward the sun, as real leaves glow from behind.
 */

/** Seconds, shared by every swaying material; set once a frame (world/city.ts). */
export const WIND = { value: 0 }

export interface Sway {
  /** Sway at the top, as a share of the plant's height. */
  bend: number
  /** Leaf flutter, as a share of the plant's height, for vertices away from the trunk. */
  flutter: number
  /** Share of the sun's light that passes through, 0 for bark. */
  translucent: number
}

const VERTEX_PARS = /* glsl */ `
uniform float windTime;
varying float vSwayOut;
`
const VERTEX = /* glsl */ `
#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 swayRoot = instanceMatrix[3].xyz;
#else
  vec3 swayRoot = modelMatrix[3].xyz;
#endif
float swayPhase = windTime * 0.9 + dot(swayRoot.xz, vec2(0.013, 0.021));
float swayH = clamp(position.y, 0.0, 1.2);
float swayGust = sin(swayPhase) + 0.45 * sin(swayPhase * 2.3 + 1.7);
transformed.xz += vec2(0.8, 0.45) * swayGust * SWAY_BEND * swayH * swayH;
float swayOut = smoothstep(0.03, 0.25, length(position.xz));
vSwayOut = swayOut;
#ifdef SWAY_FLUTTER
transformed += sin(windTime * 6.0 + position.yzx * 37.0 + swayRoot.zxy) * SWAY_FLUTTER * swayOut * swayH;
#endif
`
// Lambert keeps its lights in reflectedLight; directionalLights[0] is the sun (or the moon).
// Only leaves glow: vSwayOut is 0 on the trunk, which shares a material with the fronds on palms.
const FRAGMENT_PARS = /* glsl */ `
varying float vSwayOut;
`
const FRAGMENT = /* glsl */ `
#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
{
  vec3 toEye = normalize(vViewPosition);
  float through = pow(max(dot(-toEye, directionalLights[0].direction), 0.0), 4.0);
  reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color
    * (0.2 + 1.8 * through) * SWAY_TRANSLUCENT * vSwayOut;
}
#endif
`

const f = (v: number) => v.toFixed(4)

/** Adds wind (and, for leaves, backlight) to a plant material, after any patch it has. */
export function swaying<T extends THREE.Material>(m: T, s: Sway): T {
  // A second call would inject the wind block twice and not compile.
  if (m.userData.sway) return m
  m.userData.sway = true
  const own = m.onBeforeCompile.bind(m)
  const key = m.customProgramCacheKey()
  m.onBeforeCompile = (shader, renderer) => {
    own(shader, renderer)
    shader.uniforms.windTime = WIND
    const flutter = s.flutter > 0 ? `#define SWAY_FLUTTER ${f(s.flutter)}\n` : ''
    const defs = `#define SWAY_BEND ${f(s.bend)}\n${flutter}`
    shader.vertexShader = (defs + VERTEX_PARS + shader.vertexShader).replace(
      '#include <begin_vertex>',
      VERTEX,
    )
    if (s.translucent > 0) {
      const head = `#define SWAY_TRANSLUCENT ${f(s.translucent)}\n${FRAGMENT_PARS}`
      shader.fragmentShader = head + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        FRAGMENT,
      )
    }
  }
  m.customProgramCacheKey = () => `${key}|sway${s.bend},${s.flutter},${s.translucent}`
  return m
}
