import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { HOUSE_DESIGNS } from '../land/house-designs'
import { bakeParts, PBR_METALNESS, PBR_ROUGHNESS, PBR_VERTEX } from '../world/bake-parts'
import type { Part } from '../world/instancing'

/*
 * The six Blender houses (models/houses/houses.glb), each level baked into one mesh that one
 * material draws: every vertex carries its material (world/bake-parts.ts) and a code that
 * picks its texture, so a house is one draw call per batch however many materials it has.
 */

const URL = '/assets/models/houses/houses.glb'

// `pbr.w` codes: tinted stucco walls, the plinth (same relief), clay tile, standing-seam metal.
const STUCCO = 1
const PLINTH = 2
const TILE = 3
const METAL = 4

function codeOf(name: string): number {
  if (name.startsWith('stucco_')) return STUCCO
  return { plinth: PLINTH, roof_tile: TILE, roof_metal: METAL }[name] ?? 0
}

const VERTEX = /* glsl */ `
${PBR_VERTEX[0]}
varying float vMirror;`

// Walls take the house's paint (its instance color); everything else keeps its own.
const COLOR = /* glsl */ `
vColor = vec4(color, 1.0);
#ifdef USE_INSTANCING_COLOR
  if (abs(pbr.w - ${STUCCO}.0) < 0.5) vColor.rgb = instanceColor.rgb;
#endif`

// A garage on the left is the model mirrored: its instance matrix turns every face round,
// so the side the camera sees counts as the front again.
const MIRROR = /* glsl */ `
vMirror = 1.0;
#ifdef USE_INSTANCING
  vMirror = sign(determinant(mat3(instanceMatrix)));
#endif`

const FRAGMENT = /* glsl */ `
uniform sampler2D uTileMap;
uniform sampler2D uTileNormal;
uniform sampler2D uMetalNormal;
varying vec4 vPbr;
varying float vMirror;
float houseIs(float code) { return step(abs(vPbr.w - code), 0.5); }`

const NORMAL = /* glsl */ `
float tile = houseIs(${TILE}.0);
float metal = houseIs(${METAL}.0);
vec3 mapN = texture2D(normalMap, vNormalMapUv).xyz;
mapN = mix(mapN, texture2D(uTileNormal, vNormalMapUv).xyz, tile);
mapN = mix(mapN, texture2D(uMetalNormal, vNormalMapUv).xyz, metal) * 2.0 - 1.0;
float relief = 0.6 * (houseIs(${STUCCO}.0) + houseIs(${PLINTH}.0)) + tile + metal;
mapN.xy *= normalScale * relief;
normal = normalize(tbn * mapN);`

function houseMaterial(mats: Map<string, THREE.MeshStandardMaterial>): THREE.MeshStandardMaterial {
  const tile = mats.get('roof_tile')!
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    // Both sides, for the mirrored houses (MIRROR above).
    side: THREE.DoubleSide,
    normalMap: mats.get('stucco_white')!.normalMap,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTileMap = { value: tile.map }
    shader.uniforms.uTileNormal = { value: tile.normalMap }
    shader.uniforms.uMetalNormal = { value: mats.get('roof_metal')!.normalMap }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERTEX}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${PBR_VERTEX[1]}${MIRROR}`)
      .replace('#include <color_vertex>', COLOR)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAGMENT}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.rgb *= mix(vec3(1.0), texture2D(uTileMap, vNormalMapUv).rgb, houseIs(${TILE}.0));`,
      )
      .replace('#include <roughnessmap_fragment>', PBR_ROUGHNESS)
      .replace('#include <metalnessmap_fragment>', PBR_METALNESS)
      .replace(
        '#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace(
          'gl_FrontFacing ? 1.0 : - 1.0',
          '(gl_FrontFacing ? 1.0 : - 1.0) * vMirror',
        ),
      )
      .replace('#include <normal_fragment_maps>', NORMAL)
  }
  return mat
}

/** Per design (HOUSE_DESIGNS order), its levels of detail, nearest first, as instanceable parts. */
export async function loadHouses(load: (url: string) => Promise<GLTF>): Promise<Part[][][]> {
  const { scene } = await load(URL)
  scene.updateMatrixWorld(true)
  const mats = new Map<string, THREE.MeshStandardMaterial>()
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (m) mats.set(m.name, m)
  })
  // The glass balustrades are drawn opaque, so a house stays one draw call.
  mats.forEach((m) => (m.transparent = false))
  const material = houseMaterial(mats)
  return HOUSE_DESIGNS.map(({ name }) =>
    ['', '_lod1'].map((suffix) => {
      const root = scene.getObjectByName(`house_${name}${suffix}`)!
      const toHouse = root.matrixWorld.clone().invert()
      return [{ geometry: bakeParts([root], toHouse, codeOf, true).solid, material }]
    }),
  )
}
