import * as THREE from 'three'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'

// Ghosts along the line from the sun through the screen center: [distance along it, radius, tint].
const GHOSTS: [number, number, [number, number, number]][] = [
  [0.45, 0.025, [1.0, 0.7, 0.5]],
  [0.8, 0.06, [0.55, 0.85, 0.8]],
  [1.15, 0.018, [1.0, 0.6, 0.75]],
  [1.4, 0.1, [0.6, 0.75, 1.0]],
  [1.85, 0.04, [1.0, 0.8, 0.55]],
]

const ghosts = GHOSTS.map(
  ([k, r, [cr, cg, cb]]) =>
    `glow += vec3(${cr}, ${cg}, ${cb}) * ghost(uv, sunUv + axis * ${k.toFixed(2)}, ${r.toFixed(3)});`,
).join('\n  ')

const FRAGMENT = /* glsl */ `
uniform vec2 sunUv;
uniform float strength;
uniform vec3 tint;

float ghost(vec2 uv, vec2 center, float radius) {
  vec2 d = uv - center;
  d.x *= aspect;
  float r = length(d) / radius;
  return smoothstep(1.0, 0.7, r) * (0.4 + 0.6 * r);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  outputColor = inputColor;
  if (strength <= 0.0) return;
  // Clear sky at the sun (nothing written to depth) shows the flare; buildings and palms hide it.
  float open = 0.0;
  for (int i = 0; i < 5; i++) {
    vec2 o = vec2(float(i % 3) - 1.0, float(i / 3) * 2.0 - 1.0) * 0.006;
    open += step(0.9999, readDepth(sunUv + o));
  }
  float k = strength * open / 5.0;
  if (k <= 0.0) return;
  vec2 axis = vec2(0.5) - sunUv;
  vec3 glow = vec3(0.0);
  ${ghosts}
  vec2 s = uv - sunUv;
  s.x *= aspect;
  float halo = exp(-length(s) * 9.0) * 0.6;
  outputColor.rgb += (glow * 0.14 + halo * 0.5) * tint * k;
}
`

/**
 * A subtle lens flare from the sun: a halo and a few colored ghosts, hidden when anything
 * stands in front of the sun. Done in post because three's Lensflare copies the framebuffer,
 * which cannot read the composer's half-float buffers, and would also draw in the water mirror.
 */
export class LensFlareEffect extends Effect {
  constructor() {
    super('LensFlareEffect', FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['sunUv', new THREE.Uniform(new THREE.Vector2())],
        ['strength', new THREE.Uniform(0)],
        ['tint', new THREE.Uniform(new THREE.Color())],
      ]),
    })
  }

  /** `uv` is the sun on screen; `strength` 0 hides it (sun behind, set, or off screen). */
  set(uv: THREE.Vector2, strength: number, tint: THREE.Color): void {
    this.uniforms.get('sunUv')!.value.copy(uv)
    this.uniforms.get('strength')!.value = strength
    this.uniforms.get('tint')!.value.copy(tint)
  }
}
