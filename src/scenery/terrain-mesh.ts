import * as THREE from 'three'
import { CELL, index, type HeightGrid } from '../land/grid'
import { UNDER_CITY, type Land } from '../land/plan'

/** Cells per tile side: 64 cells is 256 m. */
const TILE = 64
/** Cell step and the camera distance (to the tile center) where each level takes over. */
const LEVELS = [
  { step: 1, from: 0 },
  { step: 2, from: 340 },
  { step: 4, from: 720 },
  { step: 8, from: 1400 },
]
// Skirts hang below every tile edge, hiding cracks where neighbours differ in detail.
const SKIRT = 6
// Tiles with less height range than this cast no shadows.
const RELIEF = 6

/** Normal from the full-detail grid, so every level of a tile shades the same. */
function normalAt(g: HeightGrid, i: number, j: number, out: THREE.Vector3): THREE.Vector3 {
  const h = (a: number, b: number) =>
    g.h[index(g, Math.min(g.nx, Math.max(0, a)), Math.min(g.nz, Math.max(0, b)))]
  return out.set(h(i - 1, j) - h(i + 1, j), 2 * CELL, h(i, j - 1) - h(i, j + 1)).normalize()
}

const FLOOR = Math.fround(UNDER_CITY)

/** Under the city's slabs: never seen, so triangles made only of these are dropped. */
const hidden = (land: Land, x: number, z: number, y: number) => {
  const c = land.land
  return y === FLOOR && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1
}

/** Height range within a tile. */
function relief(g: HeightGrid, r: Range): number {
  let lo = Infinity
  let hi = -Infinity
  for (let i = r.i0; i <= r.i1; i++) {
    for (let j = r.j0; j <= r.j1; j++) {
      const h = g.h[index(g, i, j)]
      lo = Math.min(lo, h)
      hi = Math.max(hi, h)
    }
  }
  return hi - lo
}

interface Range {
  i0: number
  j0: number
  i1: number
  j1: number
}

/** Grid indices from `a` to `b` every `step`, always ending on `b`. */
function steps(a: number, b: number, step: number): number[] {
  const out: number[] = []
  for (let v = a; v < b; v += step) out.push(v)
  return [...out, b]
}

/** Vertex buffers for one tile level; `vertex` adds one (dropped `drop` meters for skirts). */
function vertexWriter(land: Land, splat: Float32Array, center: THREE.Vector3) {
  const g = land.ground
  const buf = {
    pos: [] as number[],
    nor: [] as number[],
    spl: [] as number[],
    hid: [] as boolean[],
  }
  const n = new THREE.Vector3()
  const vertex = (i: number, j: number, drop = 0) => {
    const x = g.x0 + i * CELL
    const z = g.z0 + j * CELL
    const k = index(g, i, j)
    buf.pos.push(x - center.x, g.h[k] - drop - center.y, z - center.z)
    normalAt(g, i, j, n)
    buf.nor.push(n.x, n.y, n.z)
    buf.spl.push(splat[k * 4], splat[k * 4 + 1], splat[k * 4 + 2], splat[k * 4 + 3])
    buf.hid.push(hidden(land, x, z, g.h[k]))
    return buf.pos.length / 3 - 1
  }
  return { buf, vertex }
}

/** One level of one tile: a grid of `step`-cell quads plus skirts, positioned relative to `center`. */
function tileGeometry(
  land: Land,
  splat: Float32Array,
  r: Range,
  step: number,
  center: THREE.Vector3,
): THREE.BufferGeometry | null {
  const cols = steps(r.i0, r.i1, step)
  const rows = steps(r.j0, r.j1, step)
  const { buf, vertex } = vertexWriter(land, splat, center)
  const grid = cols.map((i) => rows.map((j) => vertex(i, j)))
  const idx: number[] = []
  const show = (a: number, b: number, c: number) => !(buf.hid[a] && buf.hid[b] && buf.hid[c])
  for (let a = 0; a + 1 < cols.length; a++) {
    for (let b = 0; b + 1 < rows.length; b++) {
      const [p, q, s, t] = [grid[a][b], grid[a + 1][b], grid[a][b + 1], grid[a + 1][b + 1]]
      if (show(p, s, q)) idx.push(p, s, q)
      if (show(q, s, t)) idx.push(q, s, t)
    }
  }
  if (!idx.length) return null
  skirts(cols, rows, grid, vertex, idx)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.nor, 3))
  geo.setAttribute('splat', new THREE.Float32BufferAttribute(buf.spl, 4))
  geo.setIndex(idx)
  geo.computeBoundingSphere()
  return geo
}

/** A curtain hanging SKIRT meters down from each tile edge, wound to face outward. */
function skirts(
  cols: number[],
  rows: number[],
  grid: number[][],
  vertex: (i: number, j: number, drop?: number) => number,
  idx: number[],
) {
  const last = { a: cols.length - 1, b: rows.length - 1 }
  const edges: [number, number][][] = [
    rows.map((_, b): [number, number] => [0, b]),
    rows.map((_, b): [number, number] => [last.a, b]).reverse(),
    cols.map((_, a): [number, number] => [a, 0]).reverse(),
    cols.map((_, a): [number, number] => [a, last.b]),
  ]
  for (const edge of edges) {
    for (let k = 0; k + 1 < edge.length; k++) {
      const [a0, b0] = edge[k]
      const [a1, b1] = edge[k + 1]
      const top0 = grid[a0][b0]
      const top1 = grid[a1][b1]
      const low0 = vertex(cols[a0], rows[b0], SKIRT)
      const low1 = vertex(cols[a1], rows[b1], SKIRT)
      idx.push(top0, low0, top1, top1, low0, low1)
    }
  }
}

/** The whole terrain as 256 m tiles, each a THREE.LOD that picks its detail by camera distance. */
export function buildTerrainMesh(
  scene: THREE.Scene,
  land: Land,
  material: THREE.Material,
  splat: Float32Array,
): void {
  const g = land.ground
  for (let i0 = 0; i0 < g.nx; i0 += TILE) {
    for (let j0 = 0; j0 < g.nz; j0 += TILE) {
      const r = { i0, j0, i1: Math.min(g.nx, i0 + TILE), j1: Math.min(g.nz, j0 + TILE) }
      const mid = index(g, (r.i0 + r.i1) >> 1, (r.j0 + r.j1) >> 1)
      const center = new THREE.Vector3(
        g.x0 + ((r.i0 + r.i1) / 2) * CELL,
        Math.max(0, g.h[mid]),
        g.z0 + ((r.j0 + r.j1) / 2) * CELL,
      )
      const lod = new THREE.LOD()
      lod.position.copy(center)
      for (const level of LEVELS) {
        const geo = tileGeometry(land, splat, r, level.step, center)
        if (!geo) break
        const mesh = new THREE.Mesh(geo, material)
        mesh.receiveShadow = true
        // Flat tiles (the beach, the fields by the city) cannot shade themselves: skip them
        // in every shadow cascade, which was a fifth of the beach view's draw calls.
        mesh.castShadow = relief(g, r) > RELIEF
        lod.addLevel(mesh, level.from)
      }
      if (lod.levels.length) scene.add(lod)
    }
  }
}
