import { offset, type P2 } from '../land/polyline'
import { HUMP } from './canal-bridge'
import { segLength } from './faces'
import { CROSSWALK, endOf, type JunctionPlan } from './junctions'
import { slice, type Network } from './network'
import type { Ring } from './polygon'
import { AVENUE, CANAL_HALF } from './streets'

/*
 * The planted medians down the avenues: a raised, curbed strip with round noses, stopping
 * short of each junction where the left-turn lane takes its place, and short of the canal's
 * humped bridges. Pure data: rings for the ground, the lawns, and the palms.
 */

/** Clear of a hump: the canal's half, the level deck, its ramp, and a little more. */
const OFF_HUMP = CANAL_HALF + HUMP.over + HUMP.ramp + 4

/** How far from a segment end the median keeps back. */
function keepBack(plans: JunctionPlan[], net: Network, seg: number, start: boolean): number {
  const s = net.segments[seg]
  const id = start ? s.a : s.b
  const plan = plans[id]
  const end = endOf(plans, net, seg, start)
  if (plan.control === 'signal' || plan.control === 'stop')
    return end.mouth + CROSSWALK.bar + AVENUE.bay
  if (plan.control === 'end') return 10
  const onCanal = net.junctions[id].segs.some((k) => net.segments[k].kind === 'canal')
  return onCanal ? OFF_HUMP : end.mouth + 4
}

/** A half circle from p to q around their midpoint, turning left of the way p->q faces. */
function nose(p: P2, q: P2): P2[] {
  const c = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }
  const r = Math.hypot(p.x - c.x, p.z - c.z)
  const a0 = Math.atan2(p.z - c.z, p.x - c.x)
  return Array.from({ length: 7 }, (_, i) => {
    const a = a0 + (Math.PI * (i + 1)) / 8
    return { x: c.x + r * Math.cos(a), z: c.z + r * Math.sin(a) }
  })
}

export interface Median {
  ring: Ring
  /** Its centerline, nose to nose. */
  line: P2[]
  /** The avenue segment it divides, and the stretch of it (meters from its start) it covers. */
  seg: number
  s0: number
  s1: number
}

/** Medians for every avenue segment long enough to hold one. */
export function medians(net: Network, plans: JunctionPlan[]): Median[] {
  const out: Median[] = []
  net.segments.forEach((s, seg) => {
    if (s.kind !== 'avenue') return
    const s0 = keepBack(plans, net, seg, true)
    const s1 = segLength(s) - keepBack(plans, net, seg, false)
    if (s1 - s0 < 10) return
    const mid = slice(s.pts, s0, s1)
    const right = offset(mid, -AVENUE.median)
    const left = offset(mid, AVENUE.median).reverse()
    // Inside on the left: up the right side, round the far nose, back down the left side.
    const ring = [
      ...right,
      ...nose(right[right.length - 1], left[0]),
      ...left,
      ...nose(left[left.length - 1], right[0]),
    ]
    out.push({ ring, line: mid, seg, s0, s1 })
  })
  return out
}
