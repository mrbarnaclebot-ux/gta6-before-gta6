import { closest, type P2 } from '../land/polyline'
import { runs } from './curbs'
import type { Block, Rect } from './layout'
import { bounds, type Ring } from './polygon'

/*
 * Surface parking lots and the driveways into them. A lot holds one or two rows of bays
 * along its long side, facing an aisle; cars park nose in. A driveway cuts the curb where
 * the lot (or a podium tower's garage) is nearest its street.
 */

const BAY = { w: 2.7, d: 5.4 }
const AISLE = 6.5
/** Driveways keep this far from a curb run's ends (the rounded corners). */
const CORNER_CLEAR = 9
export const DRIVEWAY_W = 6

/** One row of bays: their centers run from a to b; cars face `yaw`. */
interface Row {
  a: P2
  b: P2
  yaw: number
  n: number
}

/** The rows of bays in a lot. */
function rows(r: Rect): Row[] {
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0
  const long = alongX ? r.x1 - r.x0 : r.z1 - r.z0
  const short = alongX ? r.z1 - r.z0 : r.x1 - r.x0
  const n = Math.floor((long - 1) / BAY.w)
  if (n < 2 || short < BAY.d + AISLE) return []
  const sides: (-1 | 1)[] = short >= 2 * BAY.d + AISLE ? [-1, 1] : [-1]
  const mid = alongX ? (r.x0 + r.x1) / 2 : (r.z0 + r.z1) / 2
  const half = ((n - 1) * BAY.w) / 2
  return sides.map((s) => {
    // Bay centers sit half a bay in from the lot's edge on side s.
    const at = s < 0 ? (alongX ? r.z0 : r.x0) + BAY.d / 2 : (alongX ? r.z1 : r.x1) - BAY.d / 2
    const p = (u: number): P2 => (alongX ? { x: u, z: at } : { x: at, z: u })
    // Nose in: facing the lot's edge on side s.
    const yaw = alongX ? (s < 0 ? Math.PI : 0) : s < 0 ? -Math.PI / 2 : Math.PI / 2
    return { a: p(mid - half), b: p(mid + half), yaw, n }
  })
}

/** Where cars stand in a lot's bays. */
export function lotBays(lot: Ring): { x: number; z: number; yaw: number }[] {
  return rows(bounds(lot)).flatMap((row) =>
    Array.from({ length: row.n }, (_, k) => {
      const t = row.n > 1 ? k / (row.n - 1) : 0.5
      return {
        x: row.a.x + (row.b.x - row.a.x) * t,
        z: row.a.z + (row.b.z - row.a.z) * t,
        yaw: row.yaw,
      }
    }),
  )
}

/** The painted lines between bays, as short strips from a to b. */
export function bayLines(lot: Ring): [P2, P2][] {
  return rows(bounds(lot)).flatMap((row) => {
    const fx = Math.sin(row.yaw) * (BAY.d / 2)
    const fz = Math.cos(row.yaw) * (BAY.d / 2)
    const ux = (row.b.x - row.a.x) / Math.max(1, row.n - 1)
    const uz = (row.b.z - row.a.z) / Math.max(1, row.n - 1)
    return Array.from({ length: row.n + 1 }, (_, k): [P2, P2] => {
      const cx = row.a.x + ux * (k - 0.5)
      const cz = row.a.z + uz * (k - 0.5)
      return [
        { x: cx - fx * 0.9, z: cz - fz * 0.9 },
        { x: cx + fx, z: cz + fz },
      ]
    })
  })
}

/** A curb cut: its center on the curb line, facing into the block (yaw), and width. */
export interface Driveway {
  x: number
  z: number
  yaw: number
  w: number
}

/** The driveway into a target spot from the nearest street curb, clear of the corners. */
function cutFor(block: Block, to: P2): Driveway | null {
  let best: Driveway | null = null
  let bestD = Infinity
  for (const run of runs(block)) {
    if (
      (run.kind !== 'street' && run.kind !== 'avenue') ||
      run.length < 2 * CORNER_CLEAR + DRIVEWAY_W
    )
      continue
    const c = closest(run.pts, to)
    if (c.d >= bestD || c.s < CORNER_CLEAR || c.s > run.length - CORNER_CLEAR) continue
    const a = run.pts[c.i]
    const b = run.pts[c.i + 1]
    // Facing into the block: the inside lies left of the run in x, z terms.
    best = { x: c.at.x, z: c.at.z, yaw: Math.atan2(-(b.z - a.z), b.x - a.x), w: DRIVEWAY_W }
    bestD = c.d
  }
  return best
}

/** Driveways into a block's parking lots and under its podiums. */
export function drivewaysOf(block: Block): Driveway[] {
  const targets = [
    ...block.parking.map((p) => {
      const b = bounds(p)
      return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }
    }),
    ...block.buildings.filter((b) => b.base === 0 && b.w >= 24 && b.seed % 4 === 0),
  ]
  return targets.map((t) => cutFor(block, t)).filter((d): d is Driveway => d !== null)
}
