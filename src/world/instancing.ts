import * as THREE from 'three'
import type { Grounded } from '../city/layout'
import type { WorldCtx } from './blocks'
import { CHUNK, groupByChunk } from './chunks'

export interface Part {
  geometry: THREE.BufferGeometry
  material: THREE.Material
}

/**
 * Bakes every mesh of a loaded model into geometry normalized to 1 m tall, so a spot's
 * size is its height in meters. By default it is centered on x/z with its base at y = 0;
 * `keepOrigin` keeps the model's own origin (a tree's trunk base) where it is; `size`
 * overrides the height it is normalized by (parts of one model share the whole's).
 */
export function modelParts(root: THREE.Object3D, keepOrigin = false, size?: number): Part[] {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  const scale = 1 / (size ?? (keepOrigin ? box.max.y : box.max.y - box.min.y))
  const shift = keepOrigin
    ? new THREE.Vector3()
    : new THREE.Vector3(-center.x, -box.min.y, -center.z)
  const normalize = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(shift.x, shift.y, shift.z))
  const parts: Part[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const m = normalize.clone().multiply(mesh.matrixWorld)
    parts.push({
      geometry: mesh.geometry.clone().applyMatrix4(m),
      material: mesh.material as THREE.Material,
    })
  })
  return parts
}

/**
 * Small detail (ferns) lives on this layer. The main camera renders it; the water's
 * mirror camera only sees layer 0, so the reflection pass skips thousands of triangles.
 * The sun's shadow camera also only sees layer 0, so detail meshes never cast shadows.
 */
export const DETAIL_LAYER = 1

const UP = new THREE.Vector3(0, 1, 0)
const at = new THREE.Vector3()
const turn = new THREE.Quaternion()
const tilt = new THREE.Quaternion()
const size = new THREE.Vector3()
const color = new THREE.Color()

/** A grounded spot's transform: on its base height, turned by its yaw, tilted to its up vector if it has one. */
export function spotMatrix(s: Grounded, scale: number, out: THREE.Matrix4): THREE.Matrix4 {
  turn.setFromAxisAngle(UP, s.r)
  if (s.up) turn.premultiply(tilt.setFromUnitVectors(UP, at.set(s.up[0], s.up[1], s.up[2])))
  return out.compose(at.set(s.x, s.y, s.z), turn, size.setScalar(scale))
}

/** Per-instance tints as linear RGB, or null when no spot has one. */
export function spotColors(spots: Grounded[]): Float32Array | null {
  if (!spots.some((s) => s.tint !== undefined)) return null
  const out = new Float32Array(spots.length * 3)
  spots.forEach((s, i) => color.setHex(s.tint ?? 0xffffff).toArray(out, i * 3))
  return out
}

type Placement = { scale: (s: Grounded) => number }

const tmp = new THREE.Matrix4()

/** One InstancedMesh per part for these spots. */
function instanced(parts: Part[], spots: Grounded[], place: Placement) {
  const colors = spotColors(spots)
  return parts.map((part) => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, spots.length)
    spots.forEach((s, i) => mesh.setMatrixAt(i, spotMatrix(s, place.scale(s), tmp)))
    if (colors) mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
    mesh.computeBoundingSphere()
    mesh.castShadow = mesh.receiveShadow = true
    return mesh
  })
}

/**
 * Places a model at every spot: one InstancedMesh per part per `chunk`-sized square,
 * so whole chunks can be frustum-culled. Pass Infinity for one batch over the whole city.
 */
export function instanceParts(
  ctx: WorldCtx,
  parts: Part[],
  spots: Grounded[],
  place: Placement,
  chunk = CHUNK,
): void {
  for (const group of groupByChunk(spots, chunk).values()) {
    ctx.scene.add(...instanced(parts, group, place))
  }
}
