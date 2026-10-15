/*
 * GPS routes on the road grid, the same grid traffic drives (see life/lanes.ts).
 * Nodes are intersections; every neighbouring pair is joined by a road. A* with a
 * Manhattan heuristic, which never overestimates on an axis-aligned grid.
 */

export type P = { x: number; z: number }
type Grid = { xRoads: number[]; zRoads: number[] }
/** A node as [i, j]: the crossing of the road at x = xRoads[i] and the road at z = zRoads[j]. */
type Node = [number, number]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const manhattan = (a: P, b: P) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z)
/** Index of the grid segment [list[k], list[k + 1]] holding v. */
const segment = (list: number[], v: number) =>
  clamp(list.findIndex((t) => t > v) - 1, 0, list.length - 2)
const nearestIndex = (list: number[], v: number) =>
  list.reduce((best, t, k) => (Math.abs(t - v) < Math.abs(list[best] - v) ? k : best), 0)

/** The nearest point on any road, and the two intersections at the ends of its block. */
export function snap(g: Grid, p: P): { at: P; ends: [Node, Node] } {
  const { xRoads: xs, zRoads: zs } = g
  const i = nearestIndex(xs, p.x)
  const j = nearestIndex(zs, p.z)
  const onZ = { x: xs[i], z: clamp(p.z, zs[0], zs[zs.length - 1]) }
  const onX = { x: clamp(p.x, xs[0], xs[xs.length - 1]), z: zs[j] }
  if (manhattan(p, onZ) <= manhattan(p, onX)) {
    const s = segment(zs, onZ.z)
    return {
      at: onZ,
      ends: [
        [i, s],
        [i, s + 1],
      ],
    }
  }
  const s = segment(xs, onX.x)
  return {
    at: onX,
    ends: [
      [s, j],
      [s + 1, j],
    ],
  }
}

const sameBlock = (a: [Node, Node], b: [Node, Node]) =>
  a.every((n, k) => n[0] === b[k][0] && n[1] === b[k][1])

/** Road points from `from` to `to`: the snapped start, the intersections passed, the snapped end. */
export function route(g: Grid, from: P, to: P): P[] {
  const a = snap(g, from)
  const b = snap(g, to)
  if (sameBlock(a.ends, b.ends)) return [a.at, b.at]
  const nz = g.zRoads.length
  const at = ([i, j]: Node): P => ({ x: g.xRoads[i], z: g.zRoads[j] })
  const key = ([i, j]: Node) => i * nz + j
  const cost = new Map<number, number>()
  const prev = new Map<number, number>()
  // `end`: the node is a goal and f is the whole trip, including the last leg to `to`.
  const open: { n: Node; f: number; end?: true }[] = []
  const push = (n: Node, c: number, from: number) => {
    if (c >= (cost.get(key(n)) ?? Infinity)) return
    cost.set(key(n), c)
    prev.set(key(n), from)
    open.push({ n, f: c + manhattan(at(n), b.at) })
  }
  for (const n of a.ends) push(n, manhattan(a.at, at(n)), -1)
  const goals = new Set(b.ends.map(key))
  while (open.length) {
    open.sort((p, q) => q.f - p.f)
    const { n, end } = open.pop()!
    if (end) return [a.at, ...walkBack(prev, key(n), at, nz), b.at]
    const c = cost.get(key(n))!
    if (goals.has(key(n))) open.push({ n, f: c + manhattan(at(n), b.at), end: true })
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const m: Node = [n[0] + di, n[1] + dj]
      if (m[0] < 0 || m[1] < 0 || m[0] >= g.xRoads.length || m[1] >= nz) continue
      push(m, c + manhattan(at(n), at(m)), key(n))
    }
  }
  return [a.at, b.at]
}

function walkBack(prev: Map<number, number>, k: number, at: (n: Node) => P, nz: number): P[] {
  const out: P[] = []
  for (let c = k; c !== -1; c = prev.get(c)!) out.unshift(at([Math.floor(c / nz), c % nz]))
  return out
}

/** Length of a polyline in meters. */
export function pathLength(path: P[]): number {
  let d = 0
  for (let k = 1; k < path.length; k++)
    d += Math.hypot(path[k].x - path[k - 1].x, path[k].z - path[k - 1].z)
  return d
}
