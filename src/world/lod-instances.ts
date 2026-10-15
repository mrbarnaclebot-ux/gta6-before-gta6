import * as THREE from 'three'
import type { Spot } from '../city/layout'
import type { WorldCtx } from './blocks'
import { groupByChunk } from './chunks'
import { DETAIL_LAYER, type Part } from './instancing'

// Re-sorting near and far only when the camera has moved this far keeps it off most frames.
const RESORT = 4

type Placement = {
  scale: (s: Spot) => number
  ground: (s: Spot) => number
  far: number
  /** Small plants: main camera only, no shadows (see DETAIL_LAYER). */
  detail?: boolean
}

interface Chunk {
  spots: Spot[]
  /** Every spot's matrix, 16 floats each, in spot order. */
  matrices: Float32Array
  near: THREE.InstancedMesh[]
  far: THREE.InstancedMesh[]
}

const tmp = new THREE.Object3D()

function bake(spots: Spot[], place: Placement): Float32Array {
  const out = new Float32Array(spots.length * 16)
  spots.forEach((s, i) => {
    tmp.position.set(s.x, place.ground(s), s.z)
    tmp.rotation.set(0, s.r, 0)
    tmp.scale.setScalar(place.scale(s))
    tmp.updateMatrix()
    tmp.matrix.toArray(out, i * 16)
  })
  return out
}

/** One InstancedMesh per part, holding every spot so its bounding sphere covers the chunk. */
function meshes(ctx: WorldCtx, parts: Part[], matrices: Float32Array, detail = false) {
  return parts.map((part) => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length / 16)
    mesh.instanceMatrix.array.set(matrices)
    mesh.computeBoundingSphere()
    mesh.receiveShadow = true
    mesh.castShadow = !detail
    if (detail) mesh.layers.set(DETAIL_LAYER)
    ctx.scene.add(mesh)
    return mesh
  })
}

function fill(list: THREE.InstancedMesh[], n: number) {
  for (const mesh of list) {
    mesh.count = n
    mesh.visible = n > 0
    mesh.instanceMatrix.needsUpdate = true
  }
}

/** Sorts one chunk's spots into its near and far meshes by distance to `eye`. */
function sort(c: Chunk, eye: THREE.Vector3, far2: number) {
  let n = 0
  let f = 0
  c.spots.forEach((s, i) => {
    const near = (s.x - eye.x) ** 2 + (s.z - eye.z) ** 2 < far2
    const src = c.matrices.subarray(i * 16, i * 16 + 16)
    for (const mesh of near ? c.near : c.far)
      mesh.instanceMatrix.array.set(src, (near ? n : f) * 16)
    if (near) n++
    else f++
  })
  fill(c.near, n)
  fill(c.far, f)
}

/**
 * A model at every spot, detailed within `far` meters of the camera and the cheap
 * version beyond (nothing, if `distant` is empty), decided per spot. Each 250 m chunk is two draw calls per part
 * (near and far) however many trees it holds. Call the returned function every frame.
 */
export function instanceByDistance(
  ctx: WorldCtx,
  near: Part[],
  distant: Part[],
  spots: Spot[],
  place: Placement,
): (eye: THREE.Vector3) => void {
  const chunks: Chunk[] = [...groupByChunk(spots).values()].map((group) => {
    const matrices = bake(group, place)
    return {
      spots: group,
      matrices,
      near: meshes(ctx, near, matrices, place.detail),
      far: meshes(ctx, distant, matrices, place.detail),
    }
  })
  const last = new THREE.Vector3(Infinity, 0, 0)
  const far2 = place.far ** 2
  return (eye) => {
    if (last.distanceToSquared(eye) < RESORT * RESORT) return
    last.copy(eye)
    for (const c of chunks) sort(c, eye, far2)
  }
}
