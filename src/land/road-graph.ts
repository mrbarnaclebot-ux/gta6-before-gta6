import type { CityLayout } from '../city/layout'
import type { Kind, Path } from './path'
import { dist, type P2 } from './polyline'

/*
 * GPS routes over every road on the map: the city's streets and everything outside it. Road
 * centerlines become a graph of their vertices; a road that ends near another one is
 * joined to it. A* finds the quickest route by travel time, so the highway wins over
 * long trips. ponytail: one-way ramps are treated as two-way; good enough for a GPS line.
 */

/** Cruising speed per kind of road, m/s: the cost of a route is its driving time. */
const SPEED: Record<Kind | 'city', number> = {
  highway: 25,
  ramp: 15,
  avenue: 14,
  coast: 14,
  hill: 11,
  street: 9,
  loop: 7,
  trail: 4,
  city: 12,
}
// A road ending this close to another is joined to it (a cul-de-sac street's end is a few meters from its ring's nearest point).
const JOIN = 16

export interface RoadGraph {
  pts: P2[]
  /** Neighbours of each vertex and the time to reach them. */
  links: { to: number; cost: number }[][]
  /** Every edge once, for snapping a point onto the nearest road. */
  segs: [number, number][]
}

/** The city's streets as polylines, one per segment between junctions (alleys left out). */
function cityLines(c: CityLayout): { pts: P2[]; kind: 'city' | 'avenue' }[] {
  return c.net.segments
    .filter((s) => s.kind === 'avenue' || s.kind === 'street')
    .map((s) => ({ kind: s.kind === 'avenue' ? 'avenue' : 'city', pts: s.pts }))
}

/** Builds the graph from the city plan and the roads outside it (the dirt trail is left out). */
export function roadGraph(c: CityLayout, paths: Path[]): RoadGraph {
  const g: RoadGraph = { pts: [], links: [], segs: [] }
  const ids = new Map<string, number>()
  // The line that first made each vertex, so a dead end is never joined back onto its own road.
  const owner: number[] = []
  let line = 0
  const vertex = (p: P2) => {
    const key = `${Math.round(p.x * 10)},${Math.round(p.z * 10)}`
    let id = ids.get(key)
    if (id === undefined) {
      id = g.pts.push({ x: p.x, z: p.z }) - 1
      g.links.push([])
      owner.push(line)
      ids.set(key, id)
    }
    return id
  }
  const link = (a: number, b: number, speed: number) => {
    if (a === b) return
    const cost = dist(g.pts[a], g.pts[b]) / speed
    g.links[a].push({ to: b, cost })
    g.links[b].push({ to: a, cost })
    g.segs.push([a, b])
  }
  const lines = [
    ...cityLines(c),
    ...paths
      .filter((p) => p.kind !== 'trail')
      .map((p) => ({ kind: p.kind, pts: p.closed ? [...p.pts, p.pts[0]] : p.pts })),
  ]
  const ends: [number, number][] = []
  lines.forEach((l, k) => {
    line = k
    const v = l.pts.map(vertex)
    for (let i = 1; i < v.length; i++) link(v[i - 1], v[i], SPEED[l.kind])
    ends.push([v[0], k], [v[v.length - 1], k])
  })
  for (const [e, k] of ends) joinNearest(g, e, (i) => owner[i] !== k, link)
  return g
}

/** Joins a dead end to the nearest vertex of another road within JOIN meters. */
function joinNearest(
  g: RoadGraph,
  e: number,
  other: (i: number) => boolean,
  link: (a: number, b: number, s: number) => void,
) {
  if (g.links[e].length > 1) return
  let best = -1
  let bestD = JOIN
  g.pts.forEach((p, i) => {
    const d = dist(p, g.pts[e])
    if (d < bestD && other(i)) [best, bestD] = [i, d]
  })
  if (best >= 0) link(e, best, SPEED.city)
}

/** The nearest point on any road to p, and the two vertices of its segment. */
export function snap(g: RoadGraph, p: P2): { at: P2; ends: [number, number] } {
  let best = { d: Infinity, at: p, ends: [0, 0] as [number, number] }
  for (const [a, b] of g.segs) {
    const A = g.pts[a]
    const B = g.pts[b]
    const len2 = (B.x - A.x) ** 2 + (B.z - A.z) ** 2 || 1
    const t = Math.max(
      0,
      Math.min(1, ((p.x - A.x) * (B.x - A.x) + (p.z - A.z) * (B.z - A.z)) / len2),
    )
    const q = { x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t }
    const d = dist(p, q)
    if (d < best.d) best = { d, at: q, ends: [a, b] }
  }
  return best
}
