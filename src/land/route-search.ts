import { dist, type P2 } from './polyline'
import { snap, type RoadGraph } from './road-graph'

// Off-road legs (to and from the nearest road) and the heuristic both use the top speed,
// so the heuristic never overestimates and A* stays exact.
const TOP = 25

/** A tiny binary min-heap of [priority, payload]. */
class Heap {
  private items: [number, number][] = []
  get size() {
    return this.items.length
  }
  push(f: number, v: number): void {
    const a = this.items
    a.push([f, v])
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1
      if (a[p][0] <= a[i][0]) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop(): [number, number] {
    const a = this.items
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      for (let i = 0; ;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
}

/** Road points from `from` to `to`: the snapped start, the road vertices passed, the snapped end. */
export function route(g: RoadGraph, from: P2, to: P2): P2[] {
  const a = snap(g, from)
  const b = snap(g, to)
  const same = a.ends.every((v) => b.ends.includes(v))
  if (same) return [a.at, b.at]
  const cost = new Map<number, number>()
  const prev = new Map<number, number>()
  const heap = new Heap()
  // Payload -1 - v marks "arrived": vertex v plus the last leg to the target.
  const goal = new Set(b.ends)
  for (const v of a.ends) {
    const c = dist(a.at, g.pts[v]) / TOP
    cost.set(v, c)
    prev.set(v, -1)
    heap.push(c + dist(g.pts[v], b.at) / TOP, v)
  }
  while (heap.size) {
    const [, v] = heap.pop()
    if (v < 0) return [a.at, ...walkBack(g, prev, -1 - v), b.at]
    const c = cost.get(v)!
    if (goal.has(v)) heap.push(c + dist(g.pts[v], b.at) / TOP, -1 - v)
    for (const { to, cost: step } of g.links[v]) {
      if (c + step >= (cost.get(to) ?? Infinity)) continue
      cost.set(to, c + step)
      prev.set(to, v)
      heap.push(c + step + dist(g.pts[to], b.at) / TOP, to)
    }
  }
  return [a.at, b.at]
}

function walkBack(g: RoadGraph, prev: Map<number, number>, v: number): P2[] {
  const out: P2[] = []
  for (let k = v; k !== -1; k = prev.get(k)!) out.unshift(g.pts[k])
  return out
}

/** Length of a polyline in meters. */
export function pathLength(path: P2[]): number {
  let d = 0
  for (let k = 1; k < path.length; k++) d += dist(path[k - 1], path[k])
  return d
}
