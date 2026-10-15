import * as THREE from 'three'
import type { Spot } from '../city/layout'
import type { WorldCtx } from './blocks'
import { groupByChunk } from './chunks'
import { DETAIL_LAYER, type Part } from './instancing'

// Re-sorting the levels only when the camera has moved this far keeps it off most frames.
const RESORT = 4

type Placement = {
  scale: (s: Spot) => number
  ground: (s: Spot) => number
  /** Far edge of each level but the last, in meters at reach 1; the last level takes the rest. */
  ranges: number[]
  /** Small plants: main camera only, no shadows (see DETAIL_LAYER). */
  detail?: boolean
}

interface Chunk {
  spots: Spot[]
  /** Every spot's matrix, 16 floats each, in spot order. */
  matrices: Float32Array
  /** Meshes per level, nearest first. */
  levels: THREE.InstancedMesh[][]
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

/** Sorts one chunk's spots into its level meshes by distance to `eye`. */
function sort(c: Chunk, eye: THREE.Vector3, edges2: number[]) {
  const counts = c.levels.map(() => 0)
  c.spots.forEach((s, i) => {
    const d2 = (s.x - eye.x) ** 2 + (s.z - eye.z) ** 2
    let level = edges2.findIndex((e) => d2 < e)
    if (level < 0) level = c.levels.length - 1
    const at = counts[level]++ * 16
    for (const mesh of c.levels[level]) {
      const dst = mesh.instanceMatrix.array
      for (let k = 0; k < 16; k++) dst[at + k] = c.matrices[i * 16 + k]
    }
  })
  c.levels.forEach((list, k) => fill(list, counts[k]))
}

/**
 * A model at every spot in several levels of detail, nearest first, decided per spot by
 * distance (an empty level draws nothing). Each 250 m chunk is one draw call per part per
 * level however many trees it holds. Call the returned function every frame; `reach`
 * scales the ranges (the render distance).
 */
export function instanceByDistance(
  ctx: WorldCtx,
  levels: Part[][],
  spots: Spot[],
  place: Placement,
): (eye: THREE.Vector3, reach?: number) => void {
  const chunks: Chunk[] = [...groupByChunk(spots).values()].map((group) => {
    const matrices = bake(group, place)
    const meshesFor = (parts: Part[]) => meshes(ctx, parts, matrices, place.detail)
    return { spots: group, matrices, levels: levels.map(meshesFor) }
  })
  const last = new THREE.Vector3(Infinity, 0, 0)
  let lastReach = 1
  return (eye, reach = 1) => {
    if (last.distanceToSquared(eye) < RESORT * RESORT && reach === lastReach) return
    last.copy(eye)
    lastReach = reach
    const edges2 = place.ranges.map((r) => (r * reach) ** 2)
    for (const c of chunks) sort(c, eye, edges2)
  }
}
