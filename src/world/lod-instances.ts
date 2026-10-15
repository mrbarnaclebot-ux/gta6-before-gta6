import * as THREE from 'three'
import type { Grounded } from '../city/layout'
import type { WorldCtx } from './blocks'
import { groupByChunk } from './chunks'
import { DETAIL_LAYER, spotColors, spotMatrix, type Part } from './instancing'

// Re-sorting the levels only when the camera has moved this far keeps it off most frames.
const RESORT = 4

type Placement = {
  scale: (s: Grounded) => number
  /** Far edge of each level but the last, in meters at reach 1; the last level takes the rest. */
  ranges: number[]
  /** Small plants: main camera only, no shadows (see DETAIL_LAYER). */
  detail?: boolean
  /** How many levels, nearest first, cast shadows (all by default): far impostors need not. */
  shadowLevels?: number
  /** Chunk side in meters: bigger chunks mean fewer draw calls for far, sparse things. */
  chunk?: number
}

interface Chunk {
  spots: Grounded[]
  /** Every spot's matrix, 16 floats each, in spot order. */
  matrices: Float32Array
  /** Every spot's tint, 3 floats each, or null. */
  colors: Float32Array | null
  /** Center and radius of the chunk's spots on the ground. */
  x: number
  z: number
  r: number
  /** The one level every spot was last sorted into (levels.length when none is drawn), or -1 if mixed. */
  whole: number
  /** Meshes per level, nearest first. */
  levels: THREE.InstancedMesh[][]
}

const tmp = new THREE.Matrix4()

function bake(spots: Grounded[], place: Placement): Float32Array {
  const out = new Float32Array(spots.length * 16)
  spots.forEach((s, i) => spotMatrix(s, place.scale(s), tmp).toArray(out, i * 16))
  return out
}

/** One InstancedMesh per part, holding every spot so its bounding sphere covers the chunk. */
function meshes(
  ctx: WorldCtx,
  parts: Part[],
  c: Omit<Chunk, 'levels'>,
  shadows: boolean,
  detail = false,
) {
  return parts.map((part) => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, c.spots.length)
    mesh.instanceMatrix.array.set(c.matrices)
    if (c.colors) mesh.instanceColor = new THREE.InstancedBufferAttribute(c.colors.slice(), 3)
    mesh.computeBoundingSphere()
    mesh.receiveShadow = true
    mesh.castShadow = shadows && !detail
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
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }
}

/** The level a squared distance falls in: past the last edge, the last level; past `cap2`, none. */
function levelOf(d2: number, edges2: number[], levels: number, cap2: number): number {
  if (d2 >= cap2) return levels
  const k = edges2.findIndex((e) => d2 < e)
  return k < 0 ? levels - 1 : k
}

/** Sorts one chunk's spots into its level meshes by distance to `eye`; skips it when nothing can change. */
function sort(c: Chunk, eye: THREE.Vector3, edges2: number[], cap2: number) {
  const n = c.levels.length
  const d = Math.hypot(c.x - eye.x, c.z - eye.z)
  const lo = levelOf(Math.max(0, d - c.r) ** 2, edges2, n, cap2)
  const whole = lo === levelOf((d + c.r) ** 2, edges2, n, cap2) ? lo : -1
  if (whole >= 0 && whole === c.whole) return
  c.whole = whole
  const counts = c.levels.map(() => 0)
  c.spots.forEach((s, i) => {
    const level = levelOf((s.x - eye.x) ** 2 + (s.z - eye.z) ** 2, edges2, n, cap2)
    if (level === n) return
    const at = counts[level]++
    for (const mesh of c.levels[level]) {
      const dst = mesh.instanceMatrix.array
      for (let k = 0; k < 16; k++) dst[at * 16 + k] = c.matrices[i * 16 + k]
      const col = mesh.instanceColor?.array
      if (col && c.colors) for (let k = 0; k < 3; k++) col[at * 3 + k] = c.colors[i * 3 + k]
    }
  })
  c.levels.forEach((list, k) => fill(list, counts[k]))
}

/** Where a chunk's spots lie: their center and the radius that holds them all. */
function bounds(spots: Grounded[]) {
  const x = spots.reduce((a, s) => a + s.x, 0) / spots.length
  const z = spots.reduce((a, s) => a + s.z, 0) / spots.length
  const r = Math.max(...spots.map((s) => Math.hypot(s.x - x, s.z - z)))
  return { x, z, r, whole: -1 }
}

/**
 * A model at every spot in several levels of detail, nearest first, decided per spot by
 * distance (an empty level draws nothing). Each 250 m chunk is one draw call per part per
 * level however many trees it holds. Call the returned function every frame; `reach`
 * scales the ranges (the render distance), and nothing past `cap` meters is drawn.
 */
export function instanceByDistance(
  ctx: WorldCtx,
  levels: Part[][],
  spots: Grounded[],
  place: Placement,
): (eye: THREE.Vector3, reach?: number, cap?: number) => void {
  const casting = place.shadowLevels ?? levels.length
  const chunks: Chunk[] = [...groupByChunk(spots, place.chunk).values()].map((group) => {
    const c = {
      spots: group,
      matrices: bake(group, place),
      colors: spotColors(group),
      ...bounds(group),
    }
    const meshesFor = (parts: Part[], k: number) => meshes(ctx, parts, c, k < casting, place.detail)
    return { ...c, levels: levels.map(meshesFor) }
  })
  const last = new THREE.Vector3(Infinity, 0, 0)
  let lastReach = 1
  let lastCap = Infinity
  return (eye, reach = 1, cap = Infinity) => {
    const still = last.distanceToSquared(eye) < RESORT * RESORT
    if (still && reach === lastReach && cap === lastCap) return
    last.copy(eye)
    lastReach = reach
    lastCap = cap
    const edges2 = place.ranges.map((r) => (r * reach) ** 2)
    for (const c of chunks) sort(c, eye, edges2, cap * cap)
  }
}
