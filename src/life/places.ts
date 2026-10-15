import { inset, type CityLayout, type District, type Rect } from '../city/layout'

/*
 * Where people walk and where the player wakes up after dying: pure data
 * derived from the city plan.
 */

/** Pedestrians walk a loop around each block, mid-sidewalk, clear of lamps and palms. */
const BLOCK_PATH = 3
/** The beach promenade is a two-way strip: its loop is two lines 3 m apart. */
const PROMENADE_PATH = 2.5

export function walkLoops(c: CityLayout): Rect[] {
  const beachWalk = c.walks.find((w) => w.x0 > c.xRoads[c.xRoads.length - 1])
  const loops = c.blocks.map((b) => inset(b.rect, BLOCK_PATH))
  return beachWalk ? [...loops, inset(beachWalk, PROMENADE_PATH)] : loops
}

export const perimeter = (r: Rect) => 2 * (r.x1 - r.x0 + (r.z1 - r.z0))

/** Point `s` meters around the loop (clockwise from the north-west corner) and the way it runs there. */
export function loopPoint(r: Rect, s: number) {
  const w = r.x1 - r.x0
  const d = r.z1 - r.z0
  let t = ((s % perimeter(r)) + perimeter(r)) % perimeter(r)
  if (t < w) return { x: r.x0 + t, z: r.z0, dx: 1, dz: 0 }
  if ((t -= w) < d) return { x: r.x1, z: r.z0 + t, dx: 0, dz: 1 }
  if ((t -= d) < w) return { x: r.x1 - t, z: r.z1, dx: -1, dz: 0 }
  t -= w
  return { x: r.x0, z: r.z1 - t, dx: 0, dz: -1 }
}

export interface Hospital {
  name: string
  /** The respawn point on the sidewalk in front. */
  x: number
  z: number
}

const HOSPITALS: [District, string][] = [
  ['downtown', 'Downtown General'],
  ['midtown', 'Midtown Medical Center'],
  ['deco', 'Deco District Clinic'],
  ['beachfront', 'Beachfront Hospital'],
]

const center = (r: Rect) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 })

/** One hospital per district, on the block nearest the district's middle. */
export function hospitals(c: CityLayout): Hospital[] {
  return HOSPITALS.flatMap(([district, name]) => {
    const blocks = c.blocks.filter((b) => b.district === district && !b.canalSide)
    if (!blocks.length) return []
    const mid = blocks.map((b) => center(b.rect))
    const mx = mid.reduce((a, p) => a + p.x, 0) / mid.length
    const mz = mid.reduce((a, p) => a + p.z, 0) / mid.length
    const d = (i: number) => Math.hypot(mid[i].x - mx, mid[i].z - mz)
    const best = blocks.reduce((a, _, i) => (d(i) < d(a) ? i : a), 0)
    const r = blocks[best].rect
    // Between the lamp posts (0.8 m in) and the people walking by (3 m in).
    return [{ name, x: mid[best].x + 4, z: r.z1 - 1.6 }]
  })
}

export function nearest<T extends { x: number; z: number }>(list: T[], x: number, z: number): T {
  return list.reduce((a, b) =>
    Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a,
  )
}
