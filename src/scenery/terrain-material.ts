import * as THREE from 'three'
import { SEA_LEVEL } from '../city/layout'

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
uniform sampler2DArray groundAlbedo;
uniform sampler2DArray groundNormal;
varying vec4 vSplat;
varying vec3 vGroundPos;
varying vec3 vGroundNormal;
// Meters per texture repeat per layer: grass, dirt, rock, sand.
const vec4 TILE = vec4(6.0, 5.0, 11.0, 4.0);
vec4 groundWeights;
vec3 groundN;

vec4 layer(float i, float tile) {
  vec2 p = vGroundPos.xz;
  vec4 a = texture(groundAlbedo, vec3(p / tile, i));
  vec4 b = texture(groundAlbedo, vec3(p / (tile * 4.7) + 0.31, i));
  return mix(a, b, 0.42);
}
vec3 layerNormal(float i, float tile) {
  return texture(groundNormal, vec3(vGroundPos.xz / tile, i)).xyz * 2.0 - 1.0;
}
`

const MAP = /* glsl */ `
groundN = normalize(vGroundNormal);
float slope = 1.0 - groundN.y;
float rock = smoothstep(0.17, 0.32, slope + (vSplat.w - 0.5) * 0.12);
float sand = clamp(vSplat.x, 0.0, 1.0) * (1.0 - rock);
float dirt = clamp(vSplat.y, 0.0, 1.0) * (1.0 - rock) * (1.0 - sand);
float grass = max(0.0, 1.0 - rock - sand - dirt);
groundWeights = vec4(grass, dirt, rock, sand);
vec4 ground = layer(0.0, TILE.x) * grass + layer(1.0, TILE.y) * dirt
  + layer(2.0, TILE.z) * rock + layer(3.0, TILE.w) * sand;
// Large patches of lusher and drier grass, so a field never reads as one flat tint.
vec3 grassTint = mix(vec3(0.82, 0.86, 0.62), vec3(1.05, 1.08, 0.86), vSplat.w);
vec3 tint = grassTint * grass + vec3(1.0) * (dirt + rock) + vec3(1.3, 1.26, 1.18) * sand;
float depth = ${SEA_LEVEL.toFixed(2)} - vGroundPos.y;
float wet = smoothstep(-0.5, 0.15, depth) * sand;
tint *= mix(vec3(1.0), vec3(0.66, 0.62, 0.56), wet);
tint *= mix(vec3(1.0), vec3(0.32, 0.5, 0.48), smoothstep(0.3, 6.0, depth));
diffuseColor.rgb *= ground.rgb * tint;
float groundRough = mix(ground.a, 0.35, wet);
`

const NORMAL = /* glsl */ `
{
  vec3 tn = layerNormal(0.0, TILE.x) * groundWeights.x + layerNormal(1.0, TILE.y) * groundWeights.y
    + layerNormal(2.0, TILE.z) * groundWeights.z + layerNormal(3.0, TILE.w) * groundWeights.w;
  vec3 T = normalize(vec3(1.0, 0.0, 0.0) - groundN * groundN.x);
  vec3 B = cross(T, groundN);
  vec3 worldN = normalize(T * tn.x + B * tn.y + groundN * max(tn.z, 0.2));
  normal = normalize((viewMatrix * vec4(worldN, 0.0)).xyz);
}
`

export function terrainMaterial(
  albedo: THREE.Texture,
  normal: THREE.Texture,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })
  mat.onBeforeCompile = (shader) => {
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
  return mat
}
