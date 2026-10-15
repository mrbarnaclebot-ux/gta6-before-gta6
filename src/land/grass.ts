import { SEA_LEVEL } from '../city/layout'
import { surfaceAt } from '../city/terrain'
import { BLOCKED, clearAt, type Clearance } from './clearance'
import { forestAt } from './districts'
import { stand } from './footing'
import { CELL, index, slopeAt } from './grid'
import { fbm } from './noise'
import type { Land } from './plan'
import { coastX } from './shape'

/*
 * Grass clumps on a fixed world grid: one candidate per cell, kept or dropped by a hash of the
 * cell, so walking about shows the same clumps in the same places. They are made a tile of
 * cells at a time so the scenery can cache tiles instead of redoing every cell as it moves.
 */

export const GRASS_CELL = 0.9
/** A clump's base radius per meter of height. */
export const GRASS_FOOT = 0.25
export const GRASS_SINK = 0.03
/** Cells along a tile's side; a tile is GRASS_TILE meters square. */
export const TILE_CELLS = 32
export const GRASS_TILE = TILE_CELLS * GRASS_CELL
/** Floats per clump in a tile: x, y, z, scale, yaw, dry (1 for a dry straw clump, else 0). */
export const CLUMP_STRIDE = 6

// One scratch for every hash: thousands of cells per tile must not each allocate.
const H = new Float64Array(4)
const scratch = new Float32Array(TILE_CELLS * TILE_CELLS * CLUMP_STRIDE)

/** Four well-mixed numbers in [0, 1) from a cell, into H. */
function hash4(i: number, j: number): void {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263)
  for (let k = 0; k < 4; k++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) + 0x9e3779b9
    H[k] = ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
}
/** 0 to 1: how grassy the ground is, the inverse of the terrain's bare-dirt weight. */
export function grassiness(land: Land, clear: Clearance, x: number, z: number): number {
  if (clearAt(clear, x, z) === BLOCKED || x - coastX(land.frame, z) > -8) return 0
  const g = land.ground
  const i = Math.round((x - g.x0) / CELL)
  const j = Math.round((z - g.z0) / CELL)
  if (i < 0 || j < 0 || i > g.nx || j > g.nz) return 0
  const dirt = Math.max(land.dirt[index(g, i, j)] / 255, forestAt(x, z) * 0.6)
  const patches = 0.55 + 0.45 * fbm(x / 23, z / 23, 83, 2)
  return (1 - dirt) * patches * (slopeAt(g, x, z) > 0.8 ? 0 : 1)
}

/** Every clump on tile (ti, tj), set on the ground, packed CLUMP_STRIDE floats each. */
export function grassTile(land: Land, clear: Clearance, ti: number, tj: number): Float32Array {
  const surface = (a: number, b: number) => surfaceAt(land, a, b)
  let n = 0
  for (let i = ti * TILE_CELLS; i < (ti + 1) * TILE_CELLS; i++) {
    for (let j = tj * TILE_CELLS; j < (tj + 1) * TILE_CELLS; j++) {
      hash4(i, j)
      const px = (i + H[0]) * GRASS_CELL
      const pz = (j + H[1]) * GRASS_CELL
      if (H[2] > grassiness(land, clear, px, pz)) continue
      const s = 0.22 + 0.36 * H[3]
      const y = stand(surface, px, pz, GRASS_FOOT * s, GRASS_SINK)
      if (y < SEA_LEVEL + 0.3) continue
      scratch[n++] = px
      scratch[n++] = y
      scratch[n++] = pz
      scratch[n++] = s
      scratch[n++] = (H[0] + H[1]) * Math.PI * 7
      scratch[n++] = H[2] < 0.15 ? 1 : 0
    }
  }
  return scratch.slice(0, n)
}
