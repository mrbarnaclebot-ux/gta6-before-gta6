import type { CityLayout, District } from '../city/layout'
import { faceOutline } from '../city/faces'
import { onRun, runs } from '../city/curbs'
import { area, bounds, centroid } from '../city/polygon'
import { SECTION, type StreetKind } from '../city/streets'
import { stations, type P2 } from '../land/polyline'
import type { Rect } from '../city/layout'

/*
 * Where people walk and where the player wakes up after dying: pure data derived from the
 * city plan. People walk loops round each block, mid-sidewalk, and the promenade by the
 * beach; crossings.ts links the loops across the streets at the crosswalks.
 */

/** Meters in from the curb people walk: mid-sidewalk, clear of lamps, palms, and furniture. */
const WALK_IN = 3

export interface Loop {
  /** Closed ring of points; the walk runs counterclockwise in x, z terms. */
  pts: P2[]
  /** Station of each point, and the full length back to the start. */
  st: number[]
  length: number
  box: Rect
  /** The network face it goes round. */
  face: number
}

const walkIn = (k: StreetKind) => SECTION[k].half + Math.min(WALK_IN, SECTION[k].walk * 0.75)

function loopOf(pts: P2[], face: number): Loop {
  const closed = [...pts, pts[0]]
  const st = stations(closed)
  return { pts, st: st.slice(0, -1), length: st[st.length - 1], box: bounds(pts), face }
}

/** One loop per block, and one round the beach promenade. */
export function walkLoops(c: CityLayout): Loop[] {
  const out: Loop[] = []
  c.net.faces.forEach((face, id) => {
    const curb = faceOutline(c.net, face, (k) => SECTION[k].half, true)
    const edge = curb.sides.includes('edge')
    const promenade = edge && curb.sides.includes('avenue')
    if ((edge && !promenade) || area(curb.ring) < 400) return
    const ring = faceOutline(c.net, face, (k) => (k === 'edge' ? 2.5 : walkIn(k)), true, WALK_IN)
    if (area(ring.ring) > 50) out.push(loopOf(ring.ring, id))
  })
  return out
}

/** Point `s` meters round the loop (wrapping either way) and the way it runs there. */
export function loopPoint(l: Loop, s: number) {
  const t = ((s % l.length) + l.length) % l.length
  let i = 0
  while (i + 1 < l.st.length && l.st[i + 1] <= t) i++
  const a = l.pts[i]
  const b = l.pts[(i + 1) % l.pts.length]
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const f = (t - l.st[i]) / len
  return {
    x: a.x + (b.x - a.x) * f,
    z: a.z + (b.z - a.z) * f,
    dx: (b.x - a.x) / len,
    dz: (b.z - a.z) / len,
  }
}

/** Station of the loop point nearest p. */
export function loopStation(l: Loop, p: P2): number {
  let best = { d: Infinity, s: 0 }
  l.pts.forEach((a, i) => {
    const b = l.pts[(i + 1) % l.pts.length]
    const len2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2 || 1
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / len2),
    )
    const d = Math.hypot(a.x + (b.x - a.x) * t - p.x, a.z + (b.z - a.z) * t - p.z)
    if (d < best.d) best = { d, s: l.st[i] + t * Math.sqrt(len2) }
  })
  return best.s
}

export interface Hospital {
  name: string
  /** The respawn point on the sidewalk in front, and the way the street lies from it. */
  x: number
  z: number
  yaw: number
}

const HOSPITALS: [District, string][] = [
  ['downtown', 'Downtown General'],
  ['midtown', 'Midtown Medical Center'],
  ['deco', 'Deco District Clinic'],
  ['beachfront', 'Beachfront Hospital'],
]

/** One hospital per district, on the block nearest the district's middle, facing its southern street. */
export function hospitals(c: CityLayout): Hospital[] {
  return HOSPITALS.flatMap(([district, name]) => {
    const blocks = c.blocks.filter((b) => b.district === district && !b.sides.includes('canal'))
    if (!blocks.length) return []
    const mid = blocks.map((b) => centroid(b.curb))
    const mx = mid.reduce((a, p) => a + p.x, 0) / mid.length
    const mz = mid.reduce((a, p) => a + p.z, 0) / mid.length
    const d = (i: number) => Math.hypot(mid[i].x - mx, mid[i].z - mz)
    const best = blocks.reduce((a, _, i) => (d(i) < d(a) ? i : a), 0)
    const street = runs(blocks[best])
      .filter((r) => r.kind === 'street' || r.kind === 'avenue')
      .reduce((a, r) => (centroid(r.pts).z > centroid(a.pts).z ? r : a))
    // Between the lamp posts (0.8 m in) and the people walking by (3 m in).
    const p = onRun(street, street.length / 2 + 4, 1.6)
    return [{ name, x: p.x, z: p.z, yaw: p.yaw }]
  })
}

export function nearest<T extends { x: number; z: number }>(list: T[], x: number, z: number): T {
  return list.reduce((a, b) =>
    Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a,
  )
}
