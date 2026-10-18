import type { P2 } from '../land/polyline'
import type { Network, Segment } from './network'
import { drives, SECTION } from './streets'

/*
 * How each junction works for traffic and paint. Where an avenue meets other streets, traffic
 * lights; where streets meet streets, an all-way stop; where a street only passes the canal
 * or an alley, nothing. For each street end at a junction, its mouth: how far from the
 * junction's center its road clears the crossing road's curb line. Crosswalks and stop bars
 * sit just past the mouth.
 */

export type Control = 'signal' | 'stop' | 'pass' | 'end'

export interface End {
  seg: number
  /** The segment starts here (a is this junction), else it ends here. */
  start: boolean
  /** Distance along the segment from the junction to where the crossing roads' curbs end. */
  mouth: number
  /** Signal phase: ends on the main line go together (0), the rest (1). */
  phase: 0 | 1
}

export interface JunctionPlan {
  control: Control
  ends: End[]
}

/** Crosswalk across a street end, and the stop bar behind it, in meters past the mouth. */
export const CROSSWALK = { from: 0.8, to: 4.8, bar: 5.3, barWidth: 0.45 }

/** Unit direction a segment leaves junction `at` by. */
export function leaves(s: Segment, start: boolean): P2 {
  const p = start ? s.pts : [...s.pts].reverse()
  const q = p.find((v) => Math.hypot(v.x - p[0].x, v.z - p[0].z) > 0.5) ?? p[1]
  const l = Math.hypot(q.x - p[0].x, q.z - p[0].z)
  return { x: (q.x - p[0].x) / l, z: (q.z - p[0].z) / l }
}

/** How far along e its far curb line clears f's near one; 0 when they run on in line. */
function clears(e: Segment, de: P2, f: Segment, df: P2): number {
  const cos = de.x * df.x + de.z * df.z
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos))
  if (sin < 0.26) return 0
  return (SECTION[f.kind].half + SECTION[e.kind].half * Math.abs(cos)) / sin
}

const rank = (s: Segment) => (s.kind === 'avenue' ? 2 : 1)

/** Traffic control, mouths, and phases for one junction. */
function plan(net: Network, id: number): JunctionPlan {
  const j = net.junctions[id]
  const roads = j.segs
    .flatMap((seg) => {
      const s = net.segments[seg]
      const out: { seg: number; start: boolean }[] = []
      if (s.a === id) out.push({ seg, start: true })
      if (s.b === id) out.push({ seg, start: false })
      return out
    })
    .filter((e) => drives(net.segments[e.seg].kind))
  const lines = new Set(roads.map((e) => net.segments[e.seg].line))
  const segs = roads.map((e) => net.segments[e.seg])
  const dirs = roads.map((e) => leaves(net.segments[e.seg], e.start))
  const major = [...roads]
    .sort((a, b) => rank(net.segments[b.seg]) - rank(net.segments[a.seg]) || a.seg - b.seg)
    .map((e) => net.segments[e.seg].line)[0]
  // Two roads meeting (a bend, or a street passing the canal or an alley) need no control.
  const control: Control =
    roads.length < 2
      ? 'end'
      : roads.length < 3 || lines.size < 2
        ? 'pass'
        : segs.some((s) => s.kind === 'avenue')
          ? 'signal'
          : 'stop'
  const ends = roads.map((e, k): End => {
    const clear = roads.map((_, m) => (m === k ? 0 : clears(segs[k], dirs[k], segs[m], dirs[m])))
    return { ...e, mouth: Math.max(0, ...clear), phase: segs[k].line === major ? 0 : 1 }
  })
  return { control, ends }
}

/** Plans for every junction, by junction index. */
export function junctionPlans(net: Network): JunctionPlan[] {
  return net.junctions.map((_, id) => plan(net, id))
}

/** The end record of segment `seg` at its start or end junction. */
export function endOf(plans: JunctionPlan[], net: Network, seg: number, start: boolean): End {
  const s = net.segments[seg]
  return plans[start ? s.a : s.b].ends.find((e) => e.seg === seg && e.start === start)!
}
