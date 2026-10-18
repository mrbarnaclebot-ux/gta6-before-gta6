import { sampleGrid } from '../land/grid'
import { LAKE, lakeSurfaceAt } from '../land/lake'
import { roadRise } from './canal-bridge'
import type { Land } from '../land/plan'
import { CURB_H, lawnsOf, SEA_LEVEL, type CityLayout, type Rect } from './layout'
import { bounds, contains, type Ring } from './polygon'

export { CANAL_FLOOR, UNDER_CITY } from '../land/plan'

/** Ground height at (x, z) from the baked heightmap: the same surface the physics collides with. */
export function heightAt(c: Pick<Land, 'ground'>, x: number, z: number): number {
  return sampleGrid(c.ground, x, z)
}

/** Still water surface height at (x, z), or null on land: the lake's own level, else the sea's (canal and river too). */
export function waterSurfaceAt(c: Pick<Land, 'ground'>, x: number, z: number) {
  const lake = lakeSurfaceAt(LAKE, x, z)
  if (lake !== null && heightAt(c, x, z) < lake) return lake
  return heightAt(c, x, z) < SEA_LEVEL ? SEA_LEVEL : null
}

/** Park lawns sit a step above the sidewalk. */
export const PARK_TOP = CURB_H + 0.07

const within = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

/** Raised rings (sidewalks, islands, medians) and lawns, bucketed in a grid for quick lookups. */
interface Index {
  x0: number
  z0: number
  nx: number
  slabs: Ring[][]
  lawns: Ring[][]
}

const CELL = 32
const cache = new WeakMap<object, Index>()

function bucket(into: Ring[][], ring: Ring, ix: Omit<Index, 'slabs' | 'lawns'>, nz: number) {
  const b = bounds(ring)
  for (let i = Math.floor((b.x0 - ix.x0) / CELL); i <= Math.floor((b.x1 - ix.x0) / CELL); i++) {
    for (let j = Math.floor((b.z0 - ix.z0) / CELL); j <= Math.floor((b.z1 - ix.z0) / CELL); j++) {
      if (i >= 0 && j >= 0 && i < ix.nx && j < nz) into[i * nz + j].push(ring)
    }
  }
}

function index(c: CityLayout): Index {
  const hit = cache.get(c.blocks)
  if (hit) return hit
  const ix = { x0: c.land.x0, z0: c.land.z0, nx: Math.ceil((c.land.x1 - c.land.x0) / CELL) + 1 }
  const nz = Math.ceil((c.land.z1 - c.land.z0) / CELL) + 1
  const slabs: Ring[][] = Array.from({ length: ix.nx * nz }, () => [])
  const lawns: Ring[][] = Array.from({ length: ix.nx * nz }, () => [])
  for (const f of [...c.blocks, ...c.walks, ...c.islands]) bucket(slabs, f.curb, ix, nz)
  for (const m of c.medians) bucket(slabs, m.ring, ix, nz)
  for (const l of lawnsOf(c)) bucket(lawns, l, ix, nz)
  const out = { ...ix, slabs, lawns }
  cache.set(c.blocks, out)
  return out
}

/** Walkable surface height at (x, z): terrain outside the city; road, lawn, or sidewalk inside. */
export function surfaceAt(c: CityLayout & Pick<Land, 'ground'>, x: number, z: number): number {
  if (!within(c.land, x, z)) return heightAt(c, x, z)
  const ix = index(c)
  const nz = ix.slabs.length / ix.nx
  const k = Math.floor((x - ix.x0) / CELL) * nz + Math.floor((z - ix.z0) / CELL)
  const p = { x, z }
  if (ix.lawns[k]?.some((l) => contains(l, p))) return PARK_TOP
  if (ix.slabs[k]?.some((s) => contains(s, p))) return CURB_H
  return roadRise(c, x, z)
}
