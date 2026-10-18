import { closest, offset, stations, type P2 } from '../land/polyline'
import { slice, type Network, type Segment, type Side } from './network'
import { crossing, type Ring } from './polygon'
import { SECTION, type StreetKind } from './streets'

/*
 * A face's curb line and lot line: each side's centerline moved into the face by half the
 * street (and the sidewalk, for the lot), the pieces joined where they meet. Curb corners
 * between two streets are rounded with the street's curb radius; corners at the canal or
 * the city's edge stay sharp. Each piece of the ring remembers which kind of street lies
 * beyond it ('corner' for the rounded returns).
 */

export type SideKind = StreetKind | 'corner'

export interface Outline {
  ring: Ring
  /** What lies beyond ring[i] -> ring[i + 1]. */
  sides: SideKind[]
  /** The segment beyond each piece, -1 on corners. */
  segs: number[]
}

const ROADS = new Set<StreetKind>(['avenue', 'street', 'alley'])
/** Arc points every this many radians. */
const ARC_STEP = 0.2

/** Curb radius between two sides: the smaller street's, tighter at sharp corners. */
export function cornerRadius(a: StreetKind, b: StreetKind, turn: number): number {
  if (!ROADS.has(a) || !ROADS.has(b)) return 0
  const r = Math.min(SECTION[a].radius, SECTION[b].radius)
  return turn < Math.PI / 3 ? Math.min(r, 3) : r
}

const along = (s: Segment, side: Side) => (side.fwd ? s.pts : [...s.pts].reverse())

/** First place two lines cross, searching back from a's end and on from b's start; else their end lines extended. */
function meet(a: P2[], b: P2[]): P2 {
  const reach = 16
  for (let i = a.length - 2; i >= Math.max(0, a.length - 1 - reach); i--) {
    for (let j = 0; j < Math.min(b.length - 1, reach); j++) {
      const x = crossing(a[i], a[i + 1], b[j], b[j + 1])
      if (x && x.t >= -1e-6 && x.t <= 1 + 1e-6 && x.u >= -1e-6 && x.u <= 1 + 1e-6) return x.p
    }
  }
  const x = crossing(a[a.length - 2], a[a.length - 1], b[0], b[1])
  return x ? x.p : a[a.length - 1]
}

/** The turn between arriving along a and leaving along b at their shared point (pi is straight on). */
function opening(a: P2[], b: P2[]): number {
  const p = a[a.length - 2]
  const q = a[a.length - 1]
  const r = b[1]
  const u = Math.atan2(p.z - q.z, p.x - q.x)
  const v = Math.atan2(r.z - q.z, r.x - q.x)
  const d = Math.abs(u - v) % (2 * Math.PI)
  return d > Math.PI ? 2 * Math.PI - d : d
}

/** The arc from p to q around c, the short way. */
function arcPts(c: P2, p: P2, q: P2): P2[] {
  const r = Math.hypot(p.x - c.x, p.z - c.z)
  const a0 = Math.atan2(p.z - c.z, p.x - c.x)
  let a1 = Math.atan2(q.z - c.z, q.x - c.x)
  while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI
  while (a0 - a1 > Math.PI) a1 += 2 * Math.PI
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / ARC_STEP))
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return { x: c.x + r * Math.cos(a), z: c.z + r * Math.sin(a) }
  })
}

interface Corner {
  /** Station where the arriving piece ends, and where the leaving one starts. */
  end: number
  start: number
  arc: P2[]
}

/** The join between side k's piece (arriving) and the next one's (leaving). */
function corner(lines: P2[][], kinds: StreetKind[], off: number[], k: number, shrink: number) {
  const n = lines.length
  const j = (k + 1) % n
  const [a, b] = [offset(lines[k], off[k]), offset(lines[j], off[j])]
  const turn = opening(lines[k], lines[j])
  const r = shrink < 0 ? 0 : Math.max(0, cornerRadius(kinds[k], kinds[j], turn) - shrink)
  const c = r > 0 ? meet(offset(lines[k], off[k] + r), offset(lines[j], off[j] + r)) : meet(a, b)
  const ta = closest(a, c)
  const tb = closest(b, c)
  const arc = r > 0 ? arcPts(c, ta.at, tb.at) : [c]
  return { end: ta.s, start: tb.s, arc } satisfies Corner
}

/**
 * The outline of a face moved in by `inset(kind)` from each side's centerline; corners
 * rounded where `round` is set, with the curb's radius less `shrink` (a line inside the curb
 * keeps the same corner centers).
 */
export function faceOutline(
  net: Network,
  face: Side[],
  inset: (k: StreetKind) => number,
  round: boolean,
  shrink = 0,
): Outline {
  const segs = face.map((s) => net.segments[s.seg])
  const lines = face.map((side, k) => along(segs[k], side))
  const kinds = segs.map((s) => s.kind)
  const off = kinds.map(inset)
  const corners = lines.map((_, k) => corner(lines, kinds, off, k, round ? shrink : -1))
  const out: Outline = { ring: [], sides: [], segs: [] }
  const push = (p: P2, kind: SideKind, seg: number) => {
    const last = out.ring[out.ring.length - 1]
    if (last && Math.hypot(last.x - p.x, last.z - p.z) < 0.02) return
    out.ring.push(p)
    out.sides.push(kind)
    out.segs.push(seg)
  }
  lines.forEach((pts, k) => {
    const from = corners[(k + lines.length - 1) % lines.length].start
    const to = corners[k].end
    const own = offset(pts, off[k])
    if (to > from) for (const p of slice(own, from, to)) push(p, kinds[k], face[k].seg)
    const arc = corners[k].arc
    arc.forEach((p, i) =>
      push(p, i < arc.length - 1 ? 'corner' : kinds[(k + 1) % lines.length], -1),
    )
  })
  return dedupeEnds(out)
}

/** The ring is closed implicitly: drop a last point that repeats the first. */
function dedupeEnds(o: Outline): Outline {
  const a = o.ring[0]
  const b = o.ring[o.ring.length - 1]
  if (o.ring.length > 1 && Math.hypot(a.x - b.x, a.z - b.z) < 0.02) {
    o.ring.pop()
    o.sides.pop()
    o.segs.pop()
  }
  return o
}

/** Length of a segment's centerline. */
export const segLength = (s: Segment) => stations(s.pts).at(-1)!
