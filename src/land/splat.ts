import { inset, SEA_LEVEL } from '../city/layout'
import { sandAt, seaward } from './coast'
import { forestAt } from './districts'
import { CELL, index } from './grid'
import { LAKE, pastShore } from './lake'
import { fbm, smoothstep } from './noise'
import type { Land } from './plan'
import { nearRiver } from './river'
import { duneGrassAt, wildness } from './shape'

/**
 * Splat inputs per grid vertex, worked out once for every level: sand on the beaches and
 * every seabed, dirt on trails, river banks, and in the forest, shade under tree crowns,
 * and large-scale variation.
 */
export function splatGrid(land: Land, canopy: Float32Array | null): Float32Array {
  const g = land.ground
  const out = new Float32Array(g.h.length * 4)
  const mud = riverMud(land)
  const moles = land.waterways.channels.moles.map((m) => inset(m, -6))
  for (let i = 0; i <= g.nx; i++) {
    for (let j = 0; j <= g.nz; j++) {
      const x = g.x0 + i * CELL
      const z = g.z0 + j * CELL
      const k = index(g, i, j)
      const vary = 0.5 + 0.5 * fbm(x / 110, z / 110, 41, 3)
      const forest = forestAt(x, z) * (0.15 + 0.3 * vary)
      const lake = pastShore(LAKE, x, z)
      // Mud on the lake's banks, giving way to the grass a few meters up.
      const bank =
        lake > 14 ? 0 : 0.8 * (1 - smoothstep(1, 7 + 4 * fbm(x / 13, z / 13, 49, 2), lake))
      const dirt = Math.max(land.dirt[k] / 255, forest, mud[k], bank)
      // Dune grass darkens the crests it holds, so they read from afar where its cards are not drawn.
      const tufts = duneGrassAt(land.frame, x, z, seaward(land.frame.coast, x, z)) ? 0.5 : 0
      const shade = Math.max(canopy ? canopy[k] : 0, tufts)
      // Whatever lies under the sea or the lake reads as sand, whatever shore is above it.
      const wet = Math.max(
        smoothstep(SEA_LEVEL + 0.3, SEA_LEVEL - 0.4, g.h[k]),
        smoothstep(0.5, -2.5, lake),
      )
      // The breakwaters' rubble crests read as sand and grit between the rocks.
      const mole = moles.some((m) => x > m.x0 && x < m.x1 && z > m.z0 && z < m.z1) ? 1 : 0
      out.set([Math.max(beachSand(land, x, z), wet, mole), Math.min(1, dirt), shade, vary], k * 4)
    }
  }
  return out
}

/** How much the ground at (x, z) reads as beach sand. */
function beachSand(land: Land, x: number, z: number): number {
  const { coast } = land.frame
  const d = seaward(coast, x, z)
  if (d < -30) return 0
  // The sand's inland edge wanders, and grass creeps over the back dunes in tongues.
  const edge = d + 7 * fbm(x / 34, z / 34, 43, 2)
  // On the wild beaches grass and scrub hold the back dunes, darker than the bare sand.
  const back = 1 - smoothstep(3, 11, d + 6 * fbm(x / 23, z / 23, 47, 2))
  const held = 1 - 0.8 * back * wildness(land.frame, x, z)
  return smoothstep(-14, -2, edge) * smoothstep(0.2, 0.6, sandAt(coast, x, z)) * held
}

/** Bare mud on the river's banks, fading out up the valley sides. */
function riverMud(land: Land): Float32Array {
  const g = land.ground
  const mud = new Float32Array(g.h.length)
  const r = land.waterways.river
  nearRiver(g, r, 60, (k, d, i) => {
    mud[k] = 0.85 * (1 - smoothstep(r.half[i] + 4, r.half[i] + 16, d))
  })
  return mud
}
