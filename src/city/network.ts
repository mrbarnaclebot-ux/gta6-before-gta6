import { at, dist, stations, type P2 } from '../land/polyline'
import { area, crossing } from './polygon'
import type { StreetKind } from './streets'

/*
 * The city's street network as a planar graph. Hand-drawn street lines (city/street-plan.ts)
 * are cut wherever they meet; the pieces between junctions are segments, and the regions
 * they enclose are faces: blocks, walks, and the promenade. The canal and the paved city's
 * outer edge take part as lines too, so faces stop at them. Pure data.
 */

export interface StreetLine {
  name: string
  kind: StreetKind
  pts: P2[]
}

export interface Junction {
  x: number
  z: number
  /** Segments that meet here. */
  segs: number[]
}

export interface Segment {
  /** Index of the street line it is a piece of. */
  line: number
  kind: StreetKind
  /** Junctions at its start and end. */
  a: number
  b: number
  pts: P2[]
  /** Face on the left going a to b, and on the left going b to a; -1 for the outside. */
  left: number
  right: number
}

/** One side of a face: a segment, walked forward (a to b) or backward. */
export interface Side {
  seg: number
  fwd: boolean
}

export interface Network {
  lines: StreetLine[]
  junctions: Junction[]
  segments: Segment[]
  /** Faces traced with the inside on the left (positive area); the outside is left out. */
  faces: Side[][]
}

const EPS = 1e-6

/** Stations along line i where other lines cross or end on it, ends included. */
function cutsOf(lines: StreetLine[], i: number): number[] {
  const own = lines[i].pts
  const st = stations(own)
  const cuts = [0, st[st.length - 1]]
  lines.forEach((other, j) => {
    if (j === i) return
    for (let k = 1; k < own.length; k++) {
      for (let m = 1; m < other.pts.length; m++) {
        const x = crossing(own[k - 1], own[k], other.pts[m - 1], other.pts[m])
        if (!x || x.t < -EPS || x.t > 1 + EPS || x.u < -EPS || x.u > 1 + EPS) continue
        cuts.push(st[k - 1] + x.t * (st[k] - st[k - 1]))
      }
    }
  })
  cuts.sort((a, b) => a - b)
  return cuts.filter((s, k) => k === 0 || s - cuts[k - 1] > 1e-3)
}

/** The part of a line between stations s0 and s1, its own vertices kept. */
export function slice(pts: P2[], s0: number, s1: number): P2[] {
  const st = stations(pts)
  const out = [at(pts, s0)]
  for (let k = 0; k < pts.length; k++) if (st[k] > s0 + 1e-3 && st[k] < s1 - 1e-3) out.push(pts[k])
  out.push(at(pts, s1))
  return out
}

/** Cuts the lines into segments between junctions. */
function cut(lines: StreetLine[]): Pick<Network, 'junctions' | 'segments'> {
  const junctions: Junction[] = []
  const ids = new Map<string, number>()
  const node = (p: P2) => {
    const key = `${Math.round(p.x * 100)},${Math.round(p.z * 100)}`
    if (!ids.has(key)) ids.set(key, junctions.push({ x: p.x, z: p.z, segs: [] }) - 1)
    return ids.get(key)!
  }
  const segments: Segment[] = []
  lines.forEach((l, i) => {
    const cuts = cutsOf(lines, i)
    for (let k = 1; k < cuts.length; k++) {
      const pts = slice(l.pts, cuts[k - 1], cuts[k])
      const [a, b] = [node(pts[0]), node(pts[pts.length - 1])]
      const id = segments.push({ line: i, kind: l.kind, a, b, pts, left: -1, right: -1 }) - 1
      junctions[a].segs.push(id)
      junctions[b].segs.push(id)
    }
  })
  return { junctions, segments }
}

/** The way a side leaves its start junction, as an angle. */
function leaving(s: Segment, fwd: boolean): number {
  const p = fwd ? s.pts : [...s.pts].reverse()
  const q = p.find((v) => dist(v, p[0]) > 0.5) ?? p[1]
  return Math.atan2(q.z - p[0].z, q.x - p[0].x)
}

/** Sides leaving each junction, sorted counterclockwise. */
function fans(net: Pick<Network, 'junctions' | 'segments'>): Side[][] {
  return net.junctions.map((j, id) => {
    const out: Side[] = []
    for (const seg of j.segs) {
      const s = net.segments[seg]
      if (s.a === id) out.push({ seg, fwd: true })
      if (s.b === id) out.push({ seg, fwd: false })
    }
    const ang = out.map((o) => leaving(net.segments[o.seg], o.fwd))
    return out
      .map((o, k) => ({ o, a: ang[k] }))
      .sort((p, q) => p.a - q.a)
      .map((v) => v.o)
  })
}

const endOf = (s: Segment, side: Side) => (side.fwd ? s.b : s.a)

/** Traces every face: at each junction take the sharpest left, keeping the face on the left. */
function trace(net: Pick<Network, 'junctions' | 'segments'>): Side[][] {
  const fan = fans(net)
  const seen = new Set<string>()
  const key = (s: Side) => `${s.seg}${s.fwd ? '+' : '-'}`
  const faces: Side[][] = []
  for (let seg = 0; seg < net.segments.length; seg++) {
    for (const fwd of [true, false]) {
      const face: Side[] = []
      let side: Side = { seg, fwd }
      while (!seen.has(key(side))) {
        seen.add(key(side))
        face.push(side)
        const around = fan[endOf(net.segments[side.seg], side)]
        const back = around.findIndex((o) => o.seg === side.seg && o.fwd !== side.fwd)
        side = around[(back + around.length - 1) % around.length]
      }
      if (face.length) faces.push(face)
    }
  }
  return faces
}

/** The face's outline through its segments' centerlines. */
export function outline(net: Pick<Network, 'segments'>, face: Side[]): P2[] {
  return face.flatMap((side) => {
    const pts = net.segments[side.seg].pts
    return (side.fwd ? pts : [...pts].reverse()).slice(0, -1)
  })
}

/** Builds the network: segments, junctions, and the faces between them. */
export function buildNetwork(lines: StreetLine[]): Network {
  const net = cut(lines)
  const faces = trace(net).filter((f) => area(outline(net, f)) > 1)
  faces.forEach((face, id) => {
    for (const side of face) {
      const s = net.segments[side.seg]
      if (side.fwd) s.left = id
      else s.right = id
    }
  })
  return { lines, ...net, faces }
}
