import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * A model's meshes baked into one geometry for the opaque parts and one for the see-through
 * ones (glass), so a model of a dozen materials is one or two draw calls. Each vertex keeps
 * its material: `color` (linear RGB) and `pbr` (roughness, metalness, clear coat, code), where
 * `code` is a number per material name that a shader can key glow or paint off.
 */
export interface Baked {
  solid: THREE.BufferGeometry
  clear: THREE.BufferGeometry | null
}

/** The GLSL that reads `pbr` back: declarations for the vertex shader and its body. */
export const PBR_VERTEX = ['attribute vec4 pbr;\nvarying vec4 vPbr;', 'vPbr = pbr;']
export const PBR_ROUGHNESS = 'float roughnessFactor = vPbr.x;'
export const PBR_METALNESS = 'float metalnessFactor = vPbr.y;'

/** A float copy: quantized (Meshopt) attributes would clamp what the transform moves out of range. */
function floats(
  a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): THREE.BufferAttribute {
  const out = new Float32Array(a.count * a.itemSize)
  for (let i = 0; i < a.count; i++)
    for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k)
  return new THREE.BufferAttribute(out, a.itemSize)
}

function part(mesh: THREE.Mesh, toLocal: THREE.Matrix4, code: number, uv: boolean) {
  const src = mesh.geometry
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', floats(src.getAttribute('position')))
  geo.setAttribute('normal', floats(src.getAttribute('normal')))
  if (uv) {
    const n = src.getAttribute('position').count
    const at = src.getAttribute('uv')
    geo.setAttribute('uv', at ? floats(at) : new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  }
  if (src.index) geo.setIndex(src.index.clone())
  geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld))
  const m = mesh.material as THREE.MeshPhysicalMaterial
  const n = geo.attributes.position.count
  const color = new Float32Array(n * 3)
  const pbr = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    m.color.toArray(color, i * 3)
    pbr.set([m.roughness, m.metalness, m.clearcoat ?? 0, code], i * 4)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3))
  geo.setAttribute('pbr', new THREE.BufferAttribute(pbr, 4))
  return geo
}

/**
 * Every mesh under `nodes`, moved by `toLocal` (world to the output's space; the model's
 * world matrices must be current), split by whether its material blends. `code` names each
 * material's number; `uv` keeps texture coordinates (zero where a part has none).
 */
export function bakeParts(
  nodes: THREE.Object3D[],
  toLocal: THREE.Matrix4,
  code: (material: string) => number = () => 0,
  uv = false,
): Baked {
  const solid: THREE.BufferGeometry[] = []
  const clear: THREE.BufferGeometry[] = []
  for (const node of nodes)
    node.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as THREE.Material
      const list = mat.transparent ? clear : solid
      list.push(part(mesh, toLocal, code(mat.name), uv))
    })
  return {
    solid: mergeGeometries(solid)!,
    clear: clear.length ? mergeGeometries(clear) : null,
  }
}

/** Gives a plain geometry the `pbr` attribute the baked parts carry, so the two can merge. */
export function withPbr(geo: THREE.BufferGeometry, roughness: number, metalness: number) {
  const n = geo.attributes.position.count
  const pbr = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) pbr.set([roughness, metalness, 0, 0], i * 4)
  geo.setAttribute('pbr', new THREE.BufferAttribute(pbr, 4))
  return geo
}

/** A standard material for baked parts: vertex colors, and roughness and metalness per vertex. */
export function pbrMaterial(params: THREE.MeshStandardMaterialParameters = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, ...params })
  mat.customProgramCacheKey = () => 'pbr-vertex'
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PBR_VERTEX[0]}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${PBR_VERTEX[1]}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vPbr;')
      .replace('#include <roughnessmap_fragment>', PBR_ROUGHNESS)
      .replace('#include <metalnessmap_fragment>', PBR_METALNESS)
  }
  return mat
}
