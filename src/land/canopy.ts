import type { Grounded } from '../city/layout'
import { CELL, index, type HeightGrid } from './grid'

/** Crown radius as a share of tree height. */
const CROWN = 0.4

/**
 * 0 to 1 per terrain grid vertex: how much tree crown shades the ground there, so the
 * forest floor reads darker under the canopy, near and from afar.
 */
export function canopyGrid(g: HeightGrid, trees: Grounded[]): Float32Array {
  const out = new Float32Array(g.h.length)
  for (const t of trees) {
    const r = CROWN * t.s
    const i0 = Math.max(0, Math.floor((t.x - r - g.x0) / CELL))
    const j0 = Math.max(0, Math.floor((t.z - r - g.z0) / CELL))
    const i1 = Math.min(g.nx, Math.ceil((t.x + r - g.x0) / CELL))
    const j1 = Math.min(g.nz, Math.ceil((t.z + r - g.z0) / CELL))
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const d = Math.hypot(g.x0 + i * CELL - t.x, g.z0 + j * CELL - t.z) / r
        if (d < 1) out[index(g, i, j)] += 0.7 * (1 - d * d)
      }
    }
  }
  for (let k = 0; k < out.length; k++) out[k] = Math.min(1, out[k])
  return out
}
