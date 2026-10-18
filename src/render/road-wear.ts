import type * as THREE from 'three'

/*
 * Wear on the roads, drawn procedurally in world space so it costs no texture: darker
 * repair patches, cast-iron manhole covers, and oil stains on the asphalt, lane paint
 * worn thin in places, and weathered sidewalk paving. Patches and covers fade out by 140 m, where their edges would shimmer.
 * City lawns get the same treatment, so their grass texture does not tile from the air.
 */

const VERTEX_PARS = /* glsl */ `
varying vec3 vRoadPos;
`
const VERTEX = /* glsl */ `
vRoadPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#include <fog_vertex>
`
const NOISE = /* glsl */ `
varying vec3 vRoadPos;
float rwHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float rwNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rwHash(i), rwHash(i + vec2(1.0, 0.0)), f.x),
    mix(rwHash(i + vec2(0.0, 1.0)), rwHash(i + 1.0), f.x), f.y);
}
`
const ASPHALT_PARS = /* glsl */ `
${NOISE}
float rwGloss;
float rwIron;
// A repair patch: one in five 9 x 5 m cells holds a rect of newer, darker asphalt.
float rwPatch(vec2 p) {
  vec2 cell = floor(p / vec2(9.0, 5.0));
  vec2 f = fract(p / vec2(9.0, 5.0));
  vec2 lo = 0.08 + 0.35 * vec2(rwHash(cell + 1.3), rwHash(cell + 2.7));
  vec2 hi = lo + 0.25 + 0.3 * vec2(rwHash(cell + 4.1), rwHash(cell + 5.9));
  vec2 inside = step(lo, f) * step(f, hi);
  return step(rwHash(cell), 0.2) * inside.x * inside.y;
}
// A manhole cover: one in four 24 m cells, 0.75 m across, with a ring and a grip pattern.
float rwCover(vec2 p, out float ring) {
  vec2 cell = floor(p / 24.0);
  vec2 at = (cell + 0.3 + 0.4 * vec2(rwHash(cell + 3.3), rwHash(cell + 7.7))) * 24.0;
  float d = length(p - at);
  ring = smoothstep(0.3, 0.33, d) * (1.0 - smoothstep(0.34, 0.37, d));
  return step(rwHash(cell + 9.1), 0.25) * (1.0 - smoothstep(0.36, 0.38, d));
}
`
const ASPHALT = /* glsl */ `
#include <map_fragment>
{
  vec2 p = vRoadPos.xz;
  float nearRoad = 1.0 - smoothstep(60.0, 140.0, distance(vRoadPos, cameraPosition));
  float oil = smoothstep(0.66, 0.82, rwNoise(p * 0.31) * 0.7 + rwNoise(p * 1.9) * 0.3);
  float patched = rwPatch(p) * nearRoad;
  float ring;
  rwIron = rwCover(p, ring) * nearRoad;
  diffuseColor.rgb *= (1.0 - 0.4 * oil) * mix(1.0, 0.68, patched);
  float grip = 0.85 + 0.3 * step(0.5, fract((p.x + p.y) * 9.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.075, 0.07, 0.065) * grip * (1.0 - 0.6 * ring), rwIron);
  rwGloss = max(oil * 0.12, patched * 0.15);
}
`
const ASPHALT_ROUGH = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor * (1.0 - rwGloss), 0.45, rwIron);
`
const PAINT = /* glsl */ `
#include <color_fragment>
{
  vec2 p = vRoadPos.xz;
  float worn = smoothstep(0.45, 0.85, rwNoise(p * 2.3) * 0.6 + rwNoise(p * 9.0) * 0.4);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.215, 0.205), worn * 0.7);
}
`

// Paving: weathered blotches at two scales and an odd darker slab, so a long sidewalk
// does not read as one printed pattern.
const PAVING = /* glsl */ `
#include <map_fragment>
{
  vec2 p = vRoadPos.xz;
  float blotch = rwNoise(p * 0.13) * 0.6 + rwNoise(p * 0.7) * 0.4;
  float slab = step(0.93, rwHash(floor(p / 0.5)));
  diffuseColor.rgb *= (0.86 + 0.24 * blotch) * (1.0 - 0.12 * slab);
}
`

// Lawn: a second, rotated sample of the grass at another scale, blended in by slow noise,
// breaks the texture's repeat; drier and lusher patches over tens of meters vary the green.
const LAWN = /* glsl */ `
#ifdef USE_MAP
{
  vec2 p = vRoadPos.xz;
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.43 + 0.37;
  float mixing = smoothstep(0.3, 0.7, rwNoise(p * 0.05));
  diffuseColor *= mix(texture2D(map, vMapUv), texture2D(map, q), mixing);
  float macro = rwNoise(p * 0.021) * 0.65 + rwNoise(p * 0.093) * 0.35;
  diffuseColor.rgb *= mix(vec3(1.1, 1.05, 0.84), vec3(0.84, 0.97, 0.86), macro);
}
#endif
`

function patch<T extends THREE.Material>(
  m: T,
  key: string,
  pars: string,
  edits: [string, string][],
): T {
  // One wear per material: a second patch would inject the VERTEX block twice and not compile.
  if (m.userData.roadWear) return m
  m.userData.roadWear = key
  const own = m.onBeforeCompile.bind(m)
  const before = m.customProgramCacheKey()
  m.onBeforeCompile = (shader, renderer) => {
    own(shader, renderer)
    shader.vertexShader = (VERTEX_PARS + shader.vertexShader).replace(
      '#include <fog_vertex>',
      VERTEX,
    )
    let frag = pars + shader.fragmentShader
    for (const [from, to] of edits) frag = frag.replace(from, to)
    shader.fragmentShader = frag
  }
  m.customProgramCacheKey = () => `${before}|${key}`
  return m
}

/** Asphalt with repair patches, manhole covers, and oil stains. */
export const wornAsphalt = <T extends THREE.Material>(m: T): T =>
  patch(m, 'worn-asphalt', ASPHALT_PARS, [
    ['#include <map_fragment>', ASPHALT],
    ['#include <roughnessmap_fragment>', ASPHALT_ROUGH],
  ])

/** Lane paint worn thin where the noise says so. */
export const wornPaint = <T extends THREE.Material>(m: T): T =>
  patch(m, 'worn-paint', NOISE, [['#include <color_fragment>', PAINT]])

/** Sidewalk paving with weathering and the odd stained slab. */
export const wornPaving = <T extends THREE.Material>(m: T): T =>
  patch(m, 'worn-paving', NOISE, [['#include <map_fragment>', PAVING]])

/** Lawn grass without a visible repeat, in patches of drier and lusher green. */
export const patchyLawn = <T extends THREE.Material>(m: T): T =>
  patch(m, 'patchy-lawn', NOISE, [['#include <map_fragment>', LAWN]])
