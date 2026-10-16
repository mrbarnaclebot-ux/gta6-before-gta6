import { SEA_LEVEL } from '../city/layout'
import { surfaceAt } from '../city/terrain'
import type { Clearance } from './clearance'
import { grassiness, GRASS_TILE } from './grass'
import type { Land } from './plan'

/*
 * The lawn under the grass clumps: one patch of short blades per cell of a fixed world grid
 * wherever the ground is grassy, so near ground reads as one continuous sward. Patch tiles
 * line up with the grass clump tiles (GRASS_TILE), so both share the tile cache logic.
 */

/** Patches along a tile's side. */
export const LAWN_CELLS = 24
export const LAWN_CELL = GRASS_TILE / LAWN_CELLS
/** Floats per patch: x, y, z, yaw, ground normal x and z, height scale, dryness (0 to 1). */
export const PATCH_STRIDE = 8

const H = new Float64Array(4)
const scratch = new Float32Array(LAWN_CELLS * LAWN_CELLS * PATCH_STRIDE)

function hash4(i: number, j: number): void {
  let h = Math.imul(i, 2246822519) ^ Math.imul(j, 3266489917)
  for (let k = 0; k < 4; k++) {
    h = Math.imul(h ^ (h >>> 15), 2654435761) + 0x7f4a7c15
    H[k] = ((h ^ (h >>> 13)) >>> 0) / 4294967296
  }
}

/** Every patch on tile (ti, tj), set on the ground and tilted with it, PATCH_STRIDE floats each. */
export function lawnTile(land: Land, clear: Clearance, ti: number, tj: number): Float32Array {
  let n = 0
  const e = 0.5
  for (let i = ti * LAWN_CELLS; i < (ti + 1) * LAWN_CELLS; i++) {
    for (let j = tj * LAWN_CELLS; j < (tj + 1) * LAWN_CELLS; j++) {
      hash4(i, j)
      const x = (i + 0.25 + 0.5 * H[0]) * LAWN_CELL
      const z = (j + 0.25 + 0.5 * H[1]) * LAWN_CELL
      const g = grassiness(land, clear, x, z)
      if (g < 0.2 || H[2] > g * 1.6) continue
      const y = surfaceAt(land, x, z)
      if (y < SEA_LEVEL + 0.35) continue
      const dx = (surfaceAt(land, x + e, z) - surfaceAt(land, x - e, z)) / (2 * e)
      const dz = (surfaceAt(land, x, z + e) - surfaceAt(land, x, z - e)) / (2 * e)
      const len = Math.hypot(dx, 1, dz)
      scratch.set([x, y - 0.03, z, H[3] * Math.PI * 2, -dx / len, -dz / len], n)
      scratch[n + 6] = 0.55 + 0.6 * g
      scratch[n + 7] = Math.max(0, 1 - g * 1.4) + (H[3] < 0.1 ? 0.5 : 0)
      n += PATCH_STRIDE
    }
  }
  return scratch.slice(0, n)
}
