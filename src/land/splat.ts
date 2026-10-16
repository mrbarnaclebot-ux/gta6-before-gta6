import { forestAt } from './districts'
import { CELL, index } from './grid'
import { fbm, smoothstep } from './noise'
import type { Land } from './plan'
import { coastX } from './shape'

/**
 * Splat inputs per grid vertex, worked out once for every level: sand near the coast,
 * dirt on trails and in the forest, shade under tree crowns, and large-scale variation.
 */
export function splatGrid(land: Land, canopy: Float32Array | null): Float32Array {
  const g = land.ground
  const out = new Float32Array(g.h.length * 4)
  for (let i = 0; i <= g.nx; i++) {
    for (let j = 0; j <= g.nz; j++) {
      const x = g.x0 + i * CELL
      const z = g.z0 + j * CELL
      const k = index(g, i, j)
      const vary = 0.5 + 0.5 * fbm(x / 110, z / 110, 41, 3)
      const dirt = Math.max(land.dirt[k] / 255, forestAt(x, z) * (0.15 + 0.3 * vary))
      const shade = canopy ? canopy[k] : 0
      out.set(
        [smoothstep(-14, -2, x - coastX(land.frame, z)), Math.min(1, dirt), shade, vary],
        k * 4,
      )
    }
  }
  return out
}
