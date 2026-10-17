import { SEA_LEVEL } from '../city/layout'
import { CELL, type HeightGrid } from './grid'
import { smoothstep } from './noise'
import { spline, stations, type P2 } from './polyline'

/*
 * The river: from a valley head at the foot of the hills south through the residential
 * district to the south bay, an estuary at sea level the whole way, so the sea's surface
 * fills it. Its channel and valley are carved after the roads are stamped, so the roads
 * that cross it keep their height and span it on bridges.
 */

/** Head to mouth; the mouth reaches past the beach into the bay. */
const CTRL: P2[] = [
  { x: -1310, z: 72 },
  { x: -1322, z: 160 },
  { x: -1346, z: 236 },
  { x: -1344, z: 300 },
  { x: -1330, z: 385 },
  { x: -1368, z: 485 },
  { x: -1398, z: 575 },
  { x: -1362, z: 672 },
  { x: -1318, z: 762 },
  { x: -1342, z: 862 },
  { x: -1330, z: 950 },
  { x: -1322, z: 1060 },
]

/** Half the channel's width and its bed height, at the head and at the mouth. */
const HALF = { head: 7, mouth: 30 }
const BED = { head: SEA_LEVEL - 1.1, mouth: SEA_LEVEL - 3.4 }
/** The muddy bank runs from the waterline up to this height over this many meters. */
const BANK = { top: 0.5, run: 7 }
/** Valley sides above the bank: rise over run. */
const SIDE = 0.28

export interface River {
  pts: P2[]
  /** Half the channel's width at each point. */
  half: number[]
  bed: number[]
}

export function planRiver(): River {
  const pts = spline(CTRL, 4)
  const st = stations(pts)
  const total = st[st.length - 1]
  // Widens and deepens toward the sea, most of it in the last third.
  const t = st.map((s) => smoothstep(0, 1, s / total) ** 1.6)
  return {
    pts,
    half: t.map((k) => HALF.head + (HALF.mouth - HALF.head) * k),
    bed: t.map((k) => BED.head + (BED.mouth - BED.head) * k),
  }
}

/** The river's cross-section `d` meters from its centerline: bed, banks, valley sides. */
export function riverSection(d: number, half: number, bed: number): number {
  if (d <= half) return bed + (SEA_LEVEL + 0.15 - bed) * smoothstep(half * 0.35, half, d)
  if (d <= half + BANK.run)
    return SEA_LEVEL + 0.15 + ((BANK.top - SEA_LEVEL) * (d - half)) / BANK.run
  return BANK.top + (d - half - BANK.run) * SIDE
}

/** How far the valley can reach from the centerline: past this the ground is never cut. */
export const RIVER_REACH = HALF.mouth + BANK.run + 90

/** Calls `f` for every grid vertex near the river with its distance and the nearest point's index. */
export function nearRiver(
  g: HeightGrid,
  r: River,
  reach: number,
  f: (k: number, d: number, i: number) => void,
) {
  const best = new Map<number, [number, number]>()
  for (let i = 1; i < r.pts.length; i++) {
    const [a, b] = [r.pts[i - 1], r.pts[i]]
    const len2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2 || 1
    const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach - g.x0) / CELL))
    const i1 = Math.min(g.nx, Math.ceil((Math.max(a.x, b.x) + reach - g.x0) / CELL))
    const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - reach - g.z0) / CELL))
    const j1 = Math.min(g.nz, Math.ceil((Math.max(a.z, b.z) + reach - g.z0) / CELL))
    for (let ix = i0; ix <= i1; ix++) {
      for (let jz = j0; jz <= j1; jz++) {
        const x = g.x0 + ix * CELL
        const z = g.z0 + jz * CELL
        const t = Math.max(
          0,
          Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / len2),
        )
        const d = Math.hypot(x - a.x - (b.x - a.x) * t, z - a.z - (b.z - a.z) * t)
        const k = ix * (g.nz + 1) + jz
        const old = best.get(k)
        if (d <= reach && (!old || d < old[0])) best.set(k, [d, t < 0.5 ? i - 1 : i])
      }
    }
  }
  for (const [k, [d, i]] of best) f(k, d, i)
}

/** Cuts the channel and its valley into the ground: the ground never rises, only falls. */
export function carveRiver(g: HeightGrid, r: River): void {
  nearRiver(g, r, RIVER_REACH, (k, d, i) => {
    g.h[k] = Math.min(g.h[k], riverSection(d, r.half[i], r.bed[i]))
  })
}
