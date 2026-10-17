import * as THREE from 'three'
import { SEA_LEVEL } from '../city/layout'
import { underwaterLight } from '../sea/caustics'
import { SEA_PARS, type SeaUniforms } from '../sea/sea-glsl'

/*
 * Splat material for the ground: grass, dirt, rock, and sand blended per pixel. Rock
 * takes over on steep slopes; sand and dirt come from a per-vertex `splat` attribute
 * (x: sand, y: dirt, w: large-scale variation). Each layer is sampled at two scales and
 * mixed, which hides the texture repeat from a distance. Sand darkens at the waterline
 * and turns blue-green on the seabed.
 */

const VERTEX_HEAD = /* glsl */ `
attribute vec4 splat;
varying vec4 vSplat;
varying vec3 vGroundPos;
varying vec3 vGroundNormal;
`

const VERTEX_BODY = /* glsl */ `
vSplat = splat;
vGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGroundNormal = normalize(mat3(modelMatrix) * objectNormal);
`

const FRAGMENT_HEAD = /* glsl */ `
precision highp sampler2DArray;
${SEA_PARS}
uniform sampler2DArray groundAlbedo;
uniform sampler2DArray groundNormal;
varying vec4 vSplat;
varying vec3 vGroundPos;
varying vec3 vGroundNormal;
// Meters per texture repeat per layer: grass, dirt, rock, sand.
const vec4 TILE = vec4(6.0, 5.0, 11.0, 4.0);
vec4 groundWeights;
vec3 groundN;
// Gradients are taken once, outside the branches below: layers with no weight are skipped
// (most ground is one or two layers), and explicit gradients keep that legal.
vec2 gdx;
vec2 gdy;
vec3 gdx3;
vec3 gdy3;
float rippleMask;

// Wet where the swash covers the sand now or did in the last few seconds, drying behind it;
// always damp just above the still waterline.
float sandWetness(float depth) {
  if (depth < -1.2 || depth > 0.6) return depth > 0.0 ? 1.0 : 0.0;
  vec2 p = vGroundPos.xz;
  float dist = length(p - cameraPosition.xz);
  vec3 n;
  float h = vGroundPos.y - ${SEA_LEVEL.toFixed(2)};
  float wet = smoothstep(-0.3, 0.0, depth) * 0.6;
  for (int i = 0; i < 3; i++) {
    float past = seaDisplace(p, seaTime - float(i) * 1.6, dist, n).y;
    wet = max(wet, smoothstep(-0.02, 0.03, past - h) * (1.0 - float(i) * 0.25));
  }
  return wet;
}

vec4 layer(float i, float tile, float w) {
  if (w < 0.004) return vec4(0.0);
  vec2 p = vGroundPos.xz;
  float far = tile * 4.7;
  vec4 a = textureGrad(groundAlbedo, vec3(p / tile, i), gdx / tile, gdy / tile);
  vec4 b = textureGrad(groundAlbedo, vec3(p / far + 0.31, i), gdx / far, gdy / far);
  return mix(a, b, 0.42) * w;
}
// Rock on cliffs is projected from the side as well (triplanar), so steep faces are not
// streaks of a texture stretched down them; flat rock keeps the one top-down sample.
vec4 rockLayer(float tile, float w) {
  if (w < 0.004) return vec4(0.0);
  vec3 b = pow(abs(groundN), vec3(4.0));
  b /= b.x + b.y + b.z;
  if (b.y > 0.97) return layer(2.0, tile, w);
  vec3 p = vGroundPos / tile;
  vec3 dx = gdx3 / tile;
  vec3 dy = gdy3 / tile;
  vec4 c = textureGrad(groundAlbedo, vec3(p.xz, 2.0), dx.xz, dy.xz) * b.y
    + textureGrad(groundAlbedo, vec3(p.zy, 2.0), dx.zy, dy.zy) * b.x
    + textureGrad(groundAlbedo, vec3(p.xy, 2.0), dx.xy, dy.xy) * b.z;
  return c * w;
}
vec3 layerNormal(float i, float tile, float w) {
  if (w < 0.004) return vec3(0.0);
  vec3 n = textureGrad(groundNormal, vec3(vGroundPos.xz / tile, i), gdx / tile, gdy / tile).xyz;
  return (n * 2.0 - 1.0) * w;
}
`

const MAP = /* glsl */ `
groundN = normalize(vGroundNormal);
gdx3 = dFdx(vGroundPos);
gdy3 = dFdy(vGroundPos);
gdx = gdx3.xz;
gdy = gdy3.xz;
float slope = 1.0 - groundN.y;
float rock = smoothstep(0.26, 0.42, slope + (vSplat.w - 0.5) * 0.12);
float sand = clamp(vSplat.x, 0.0, 1.0) * (1.0 - rock);
float dirt = clamp(vSplat.y, 0.0, 1.0) * (1.0 - rock) * (1.0 - sand);
float grass = max(0.0, 1.0 - rock - sand - dirt);
groundWeights = vec4(grass, dirt, rock, sand);
vec4 ground = layer(0.0, TILE.x, grass) + layer(1.0, TILE.y, dirt)
  + rockLayer(TILE.z, rock) + layer(3.0, TILE.w, sand);
// The grass layer's photo is half bare soil: pull it toward a sward, its own detail kept as
// brightness. Large patches of lusher and drier grass, and a finer mottle, break up the field.
float grassLuma = dot(ground.rgb, vec3(0.3, 0.59, 0.11)) / max(grass, 1e-3);
float mottle = textureGrad(groundAlbedo, vec3(vGroundPos.xz / 61.0, 0.0), gdx / 61.0, gdy / 61.0).g;
vec3 sward = mix(vec3(0.34, 0.56, 0.13), vec3(0.66, 0.64, 0.28), smoothstep(0.35, 0.8, vSplat.w));
sward *= 0.75 + 0.6 * mottle;
ground.rgb = mix(ground.rgb, sward * grassLuma * 1.5 * grass, 0.65 * grass);
vec3 grassTint = mix(vec3(0.9, 0.95, 0.75), vec3(1.05, 1.06, 0.9), vSplat.w);
vec3 tint = grassTint * grass + vec3(1.0) * (dirt + rock) + vec3(1.3, 1.26, 1.18) * sand;
float depth = ${SEA_LEVEL.toFixed(2)} - vGroundPos.y;
float wet = sandWetness(depth) * sand;
tint *= mix(vec3(1.0), vec3(0.44, 0.4, 0.35), wet);
// The wrack line: a ragged band of darker, damp sand where the high tide stopped.
float aboveSea = -depth + 0.1 * (mottle - 0.5);
float wrack = smoothstep(0.22, 0.3, aboveSea) * (1.0 - smoothstep(0.42, 0.55, aboveSea));
tint *= mix(vec3(1.0), vec3(0.74, 0.68, 0.58), wrack * sand * (1.0 - wet));
// Ripples on the wet sand and the shallow seabed, near the camera only (they would shimmer far off).
rippleMask = sand * smoothstep(-0.35, 0.0, depth) * (1.0 - smoothstep(1.2, 2.8, depth))
  * (1.0 - smoothstep(22.0, 40.0, distance(vGroundPos.xz, cameraPosition.xz)));
tint *= mix(vec3(1.0), vec3(0.55, 0.72, 0.7), smoothstep(0.3, 6.0, depth));
// Shade and leaf litter under tree crowns: the forest floor reads darker than the fields.
tint *= mix(vec3(1.0), vec3(0.4, 0.44, 0.32), clamp(vSplat.z, 0.0, 1.0));
diffuseColor.rgb *= ground.rgb * tint;
float groundRough = mix(ground.a, 0.6, wet);
`

const NORMAL = /* glsl */ `
{
  vec4 w = groundWeights;
  vec3 tn = layerNormal(0.0, TILE.x, w.x) + layerNormal(1.0, TILE.y, w.y)
    + layerNormal(2.0, TILE.z, w.z) + layerNormal(3.0, TILE.w, w.w);
  vec3 T = normalize(vec3(1.0, 0.0, 0.0) - groundN * groundN.x);
  vec3 B = cross(T, groundN);
  vec3 worldN = normalize(T * tn.x + B * tn.y + groundN * max(tn.z, 0.2));
  if (rippleMask > 0.01) {
    // Crests run along the shore: across the gradient of the baked shore distance.
    vec2 p = vGroundPos.xz;
    float s0 = seaFieldAt(p).y;
    vec2 g = vec2(seaFieldAt(p + vec2(2.0, 0.0)).y - s0, seaFieldAt(p + vec2(0.0, 2.0)).y - s0);
    g /= max(length(g), 1e-4);
    vec4 n2 = textureGrad(groundAlbedo, vec3(p / 9.0, 3.0), gdx / 9.0, gdy / 9.0);
    // Bend the crests and break them into patches, so they never read as corduroy.
    g = normalize(g + vec2(n2.g - 0.5, n2.b - 0.5) * 0.9);
    float ph = dot(p, g) * 15.0 + n2.r * 11.0;
    float patchy = smoothstep(0.3, 0.6, n2.g);
    worldN = normalize(worldN + vec3(g.x, 0.0, g.y) * cos(ph) * 0.22 * rippleMask * patchy);
  }
  normal = normalize((viewMatrix * vec4(worldN, 0.0)).xyz);
}
`

export function terrainMaterial(
  albedo: THREE.Texture,
  normal: THREE.Texture,
  sea: SeaUniforms,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sea)
    shader.uniforms.groundAlbedo = { value: albedo }
    shader.uniforms.groundNormal = { value: normal }
    shader.vertexShader =
      VERTEX_HEAD +
      shader.vertexShader.replace('#include <fog_vertex>', VERTEX_BODY + '#include <fog_vertex>')
    shader.fragmentShader = (FRAGMENT_HEAD + shader.fragmentShader)
      .replace('#include <map_fragment>', MAP)
      .replace(
        '#include <roughnessmap_fragment>',
        'float roughnessFactor = roughness * groundRough;',
      )
      .replace('#include <normal_fragment_maps>', NORMAL)
  }
  mat.customProgramCacheKey = () => 'ground-splat'
  return underwaterLight(mat)
}
