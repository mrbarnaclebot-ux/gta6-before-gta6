import type { CityLayout } from '../city/layout'
import { segLength } from '../city/faces'
import { CROSSWALK, leaves } from '../city/junctions'
import { SECTION } from '../city/streets'
import { at, type P2 } from '../land/polyline'
import { loopPoint, loopStation, type Loop } from './places'

/*
 * The crosswalks people use: at every junction with lights or stop signs, across each
 * street end, from the walking loop on one side to the loop on the other. Pure data.
 */

export interface Crossing {
  /** Loop and station where the crossing starts, and where it lands. */
  from: number
  s: number
  to: number
  s2: number
  a: P2
  b: P2
  junction: number
  /** The phase of the traffic it crosses; with lights, people wait for its red. */
  phase: 0 | 1
  signal: boolean
}

/** Both ways over every crosswalk. */
export function crossings(c: CityLayout, loops: Loop[]): Crossing[] {
  const byFace = new Map(loops.map((l, i) => [l.face, i]))
  const out: Crossing[] = []
  c.junctions.forEach((plan, junction) => {
    if (plan.control !== 'signal' && plan.control !== 'stop') return
    for (const end of plan.ends) {
      const s = c.net.segments[end.seg]
      const u = end.mouth + (CROSSWALK.from + CROSSWALK.to) / 2
      const len = segLength(s)
      if (u > len / 2) continue
      const mid = at(s.pts, end.start ? u : len - u)
      const d = leaves(s, end.start)
      // Left of the way out of the junction (x, z terms) lies the segment's left face going a to b.
      const faces = end.start ? [s.left, s.right] : [s.right, s.left]
      const reach = SECTION[s.kind].half + 3
      const sides = [1, -1].map((k) => ({ x: mid.x - d.z * reach * k, z: mid.z + d.x * reach * k }))
      const ids = faces.map((f) => byFace.get(f))
      if (ids[0] === undefined || ids[1] === undefined) continue
      const st = sides.map((p, k) => loopStation(loops[ids[k]!], p))
      const ends = st.map((v, k) => loopPoint(loops[ids[k]!], v))
      const base = { junction, phase: end.phase, signal: plan.control === 'signal' }
      out.push({ ...base, from: ids[0], s: st[0], to: ids[1], s2: st[1], a: ends[0], b: ends[1] })
      out.push({ ...base, from: ids[1], s: st[1], to: ids[0], s2: st[0], a: ends[1], b: ends[0] })
    }
  })
  return out
}
