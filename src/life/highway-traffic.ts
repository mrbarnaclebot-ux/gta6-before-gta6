import type { Rand } from '../city/rng'
import type { LaneEdge } from '../land/lane-graph'
import type { Start, Waypoint } from './lanes'

/** Through traffic stays on the highway three times in four; the rest take the exit. */
const STAY = 3

const points = (e: LaneEdge, from: number): Waypoint[] =>
  e.pts.slice(from).map((p) => ({ x: p.x, y: p.y, z: p.z, limit: e.limit }))

/** Picks the next edge: the first listed (straight on) is STAY times as likely as each other. */
function choose(e: LaneEdge, r: Rand): number {
  const weights = e.next.map((_, k) => (k === 0 ? STAY : 1))
  let roll = r() * weights.reduce((a, b) => a + b, 0)
  for (let k = 0; k < weights.length; k++) if ((roll -= weights[k]) < 0) return e.next[k]
  return e.next[e.next.length - 1]
}

/** A random spot on the highway's lanes (longer edges more likely), driving on from there. */
export function highwayStart(edges: LaneEdge[], r: Rand): Start {
  const total = edges.reduce((s, e) => s + e.pts.length, 0)
  let pick = Math.floor(r() * total)
  let id = 0
  while (pick >= edges[id].pts.length) pick -= edges[id++].pts.length
  const e = edges[id]
  const i = Math.min(pick, e.pts.length - 2)
  const a = e.pts[i]
  const b = e.pts[i + 1]
  let first = true
  const driver = {
    next: () => {
      if (first) {
        first = false
        return points(e, i + 1)
      }
      id = choose(edges[id], r)
      return points(edges[id], 1)
    },
  }
  return { x: a.x, y: a.y, z: a.z, yaw: Math.atan2(b.x - a.x, b.z - a.z), driver }
}
