import { EAST_X, LANES, LEG_Z, TERMINAL } from './highway'
import type { Path } from './path'
import { arc, closest, offset, stations, type P2, type P3 } from './polyline'

/*
 * The lanes traffic drives on the highway, as a directed graph. Each edge is a run of
 * waypoints (with heights, so cars climb the bridges) and a speed limit; `next` lists the
 * edges a car may take from its end. Outbound runs the highway's own direction (north
 * beach, west, south, east to the south beach), inbound the reverse; a turnaround loop at
 * each beach joins them. At each interchange a car may leave by the off-ramp and rejoin
 * straight across the crossing road, or swing under the bridge and rejoin the other way.
 */

export interface LaneEdge {
  pts: P3[]
  /** Speed limit, m/s. */
  limit: number
  next: number[]
}

const SPEED = { main: 24, ramp: 14, cross: 6, loop: 8 }

/** A quadratic curve from a to b bulging toward c, with heights eased from a to b. */
function curve(a: P3, c: P2, b: P3, n = 10): P3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const [p, q, s] = [(1 - t) ** 2, 2 * t * (1 - t), t * t]
    return {
      x: p * a.x + q * c.x + s * b.x,
      y: a.y + (b.y - a.y) * t,
      z: p * a.z + q * c.z + s * b.z,
    }
  })
}

/** Splits a lane polyline at the given stations (of its own points, in travel order), exactly. */
function split(pts: P3[], cuts: number[]): P3[][] {
  const st = stations(pts)
  const out: P3[][] = []
  let run: P3[] = [pts[0]]
  let i = 1
  for (const s of cuts) {
    for (; i < pts.length && st[i] < s; i++) run.push(pts[i])
    const t = (s - st[i - 1]) / (st[i] - st[i - 1] || 1)
    const a = pts[i - 1]
    const b = pts[i]
    const cut = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
    out.push([...run, cut])
    run = [cut]
  }
  out.push([...run, ...pts.slice(i)])
  return out
}

type Add = (pts: P3[], limit: number) => number

/** Ramps by the crossing they serve: 'ramp off out -300' belongs to the crossing at z = -300. */
function byCrossing(ramps: Path[]): Map<string, Path[]> {
  const out = new Map<string, Path[]>()
  for (const r of ramps) {
    const key = r.name.split(' ').at(-1)!
    out.set(key, [...(out.get(key) ?? []), r])
  }
  return out
}

/** The highway lane graph from the highway path and its ramps (as built by buildHighway). */
export function laneGraph(highway: Path, ramps: Path[]): LaneEdge[] {
  const edges: LaneEdge[] = []
  const add: Add = (pts, limit) => edges.push({ pts, limit, next: [] }) - 1
  const out = offset(highway.pts, LANES[1])
  const inb = offset([...highway.pts].reverse(), LANES[1])
  const groups = [...byCrossing(ramps)]
    .map(([z, list]) => ({ list, s: closest(highway.pts, { x: EAST_X, z: Number(z) }).s }))
    .sort((a, b) => a.s - b.s)
  // Cut each lane where its own ramps leave and join it: lanes on a curve are longer or
  // shorter than the centerline, so centerline stations would leave gaps.
  const ramp = (g: (typeof groups)[number], name: string) =>
    g.list.find((r) => r.name.startsWith(`ramp ${name} `))!.pts
  const cutsOut = groups.flatMap((g) => [
    closest(out, ramp(g, 'off out')[0]).s,
    closest(out, ramp(g, 'on out').at(-1)!).s,
  ])
  const cutsIn = [...groups]
    .reverse()
    .flatMap((g) => [
      closest(inb, ramp(g, 'off in')[0]).s,
      closest(inb, ramp(g, 'on in').at(-1)!).s,
    ])
  const mainOut = split(out, cutsOut).map((p) => add(p, SPEED.main))
  const mainIn = split(inb, cutsIn).map((p) => add(p, SPEED.main))
  for (const list of [mainOut, mainIn])
    for (let k = 0; k + 1 < list.length; k++) edges[list[k]].next.push(list[k + 1])
  groups.forEach((g, k) => {
    const j = groups.length - 1 - k
    const main = {
      out: [mainOut[2 * k], mainOut[2 * k + 2]],
      in: [mainIn[2 * j], mainIn[2 * j + 2]],
    }
    interchange(edges, add, g.list, highway, main)
  })
  turnarounds(edges, add, mainOut, mainIn)
  return edges
}

/** Wires one diamond: main lanes to off-ramps, across or under the bridge, on-ramps back to main. */
function interchange(
  edges: LaneEdge[],
  add: Add,
  ramps: Path[],
  hw: Path,
  main: { out: number[]; in: number[] },
) {
  const find = (name: string) => ramps.find((r) => r.name.startsWith(`ramp ${name} `))!
  const [offOut, onOut, offIn, onIn] = ['off out', 'on out', 'off in', 'on in'].map((n) =>
    add(find(n).pts, SPEED.ramp),
  )
  const end = (e: number) => edges[e].pts[edges[e].pts.length - 1]
  const start = (e: number) => edges[e].pts[0]
  const mid = (p: P2): P2 => hw.pts[closest(hw.pts, p).i]
  const across = (a: number, b: number) => add([end(a), start(b)], SPEED.cross)
  const under = (a: number, b: number) => add(curve(end(a), mid(end(a)), start(b)), SPEED.cross)
  const links: [number, number, number][] = [
    [offOut, across(offOut, onOut), onOut],
    [offOut, under(offOut, onIn), onIn],
    [offIn, across(offIn, onIn), onIn],
    [offIn, under(offIn, onOut), onOut],
  ]
  for (const [a, link, b] of links) {
    edges[a].next.push(link)
    edges[link].next.push(b)
  }
  edges[main.out[0]].next.push(offOut)
  edges[onOut].next.push(main.out[1])
  edges[main.in[0]].next.push(offIn)
  edges[onIn].next.push(main.in[1])
}

/** A loop round each beach roundabout joining the end of one direction to the start of the other. */
function turnarounds(edges: LaneEdge[], add: Add, mainOut: number[], mainIn: number[]) {
  for (const [from, to] of [
    [mainOut[mainOut.length - 1], mainIn[0]],
    [mainIn[mainIn.length - 1], mainOut[0]],
  ]) {
    const a = edges[from].pts.at(-1)!
    const b = edges[to].pts[0]
    const cz = Math.sign(a.z) * LEG_Z
    const r = Math.hypot(a.x - TERMINAL.x, a.z - cz)
    const a0 = Math.atan2(a.z - cz, a.x - TERMINAL.x)
    let a1 = Math.atan2(b.z - cz, b.x - TERMINAL.x)
    // Counterclockwise on the map (decreasing angle, z pointing south), the long way round.
    while (a1 >= a0) a1 -= Math.PI * 2
    const loop = add(
      arc(TERMINAL.x, cz, r, a0, a1).map((p) => ({ ...p, y: a.y })),
      SPEED.loop,
    )
    edges[from].next.push(loop)
    edges[loop].next.push(to)
  }
}
