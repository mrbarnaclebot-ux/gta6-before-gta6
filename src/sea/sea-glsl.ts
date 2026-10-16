import * as THREE from 'three'
import type { SeaField } from './field'
import { FIELD_CELL } from './field'
import { CAUSTICS, SEA_TIME_GLSL } from './caustics'
import { angularSpeed, gerstnerQ, SURF, WAVES, waveNumber } from './waves'

/*
 * The waves of waves.ts as GLSL, written out from the same constants. Shared by the
 * water, the surface seen from below, and the sand's swash.
 */

const f = (n: number) => n.toFixed(6)

// Small waves fade out with distance before the grid gets too coarse to draw them.
const waveTerm = (w: (typeof WAVES)[number]) => /* glsl */ `
  {
    float a = ${f(w.amp)} * f.z * (1.0 - smoothstep(${f(w.length * 2.5)}, ${f(w.length * 5)}, dist));
    float th = ${f(waveNumber(w))} * dot(vec2(${f(w.dir[0])}, ${f(w.dir[1])}), p)
      - ${f(angularSpeed(w))} * t + ${f(w.phase)};
    float c = cos(th);
    float s = sin(th);
    float q = ${f(gerstnerQ(w))} * a * c;
    d += vec3(q * ${f(w.dir[0])}, a * s, q * ${f(w.dir[1])});
    float ka = ${f(waveNumber(w))} * a;
    slope += vec2(${f(w.dir[0])}, ${f(w.dir[1])}) * ka * c;
    lift += ${f(gerstnerQ(w))} * ka * s;
  }`

export const SEA_PARS = /* glsl */ `
uniform sampler2D seaField;
uniform vec4 seaRect;
${SEA_TIME_GLSL}
// x: depth at rest, y: signed shore distance, z: wave scale. Past the field it is open sea.
vec3 seaFieldAt(vec2 xz) {
  vec2 uv = (xz - seaRect.xy) / seaRect.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec3(12.0, 1e4, 1.0);
  return texture2D(seaField, uv).rgb;
}
float seaSurfPhase(vec2 p, float t, float shore) {
  float wobble = 0.9 * sin(0.021 * p.x + 0.034 * p.y) + 0.6 * sin(0.047 * p.y - 0.013 * p.x);
  return 6.2831853 * (shore / ${f(SURF.length)} + t / ${f(SURF.period)}) + wobble;
}
float seaSurfBuild(float shore) {
  return smoothstep(${f(SURF.from)}, ${f(SURF.to)}, shore);
}
// Displacement of the rest point p (x/z) at time t, and the surface normal there.
// dist: meters from the camera, for fading out waves the mesh is too coarse to draw.
vec3 seaDisplace(vec2 p, float t, float dist, out vec3 normal) {
  vec3 f = seaFieldAt(p);
  vec3 d = vec3(0.0);
  vec2 slope = vec2(0.0);
  float lift = 0.0;
  ${WAVES.map(waveTerm).join('\n')}
  float build = seaSurfBuild(f.y);
  if (build > 0.0) {
    float th = seaSurfPhase(p, t, f.y);
    float c = 0.5 + 0.5 * cos(th);
    float amp = ${f(SURF.amp)} * build * f.z;
    d.y += amp * (2.0 * c * c * c - 0.625);
    // The crest runs up the shore distance's gradient.
    vec2 g = vec2(seaFieldAt(p + vec2(1.0, 0.0)).y, seaFieldAt(p + vec2(0.0, 1.0)).y) - f.y;
    slope += -amp * 3.0 * c * c * sin(th) * 6.2831853 / ${f(SURF.length)} * g;
  }
  normal = normalize(vec3(-slope.x, 1.0 - lift, -slope.y));
  return d;
}
`

/** Uniforms for SEA_PARS, shared by reference: one clock and one field for every sea shader. */
export interface SeaUniforms {
  seaField: { value: THREE.DataTexture }
  seaRect: { value: THREE.Vector4 }
  seaTime: { value: number }
}

/** The field as a half-float RGBA texture: depth, shore distance, wave scale. */
export function seaUniforms(field: SeaField): SeaUniforms {
  const n = field.w * field.h
  const data = new Uint16Array(n * 4)
  const half = THREE.DataUtils.toHalfFloat
  for (let k = 0; k < n; k++) {
    data[k * 4] = half(field.depth[k])
    data[k * 4 + 1] = half(Math.min(field.shore[k], 6e4))
    data[k * 4 + 2] = half(field.scale[k])
  }
  const tex = new THREE.DataTexture(data, field.w, field.h, THREE.RGBAFormat, THREE.HalfFloatType)
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  // Texel centers sit on the field's sample points.
  const c = FIELD_CELL
  const rect = new THREE.Vector4(field.x0 - c / 2, field.z0 - c / 2, field.w * c, field.h * c)
  return { seaField: { value: tex }, seaRect: { value: rect }, seaTime: CAUSTICS.seaTime }
}
