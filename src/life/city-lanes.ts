import { roadRise } from '../city/canal-bridge'
import { segLength } from '../city/faces'
import { CROSSWALK, endOf } from '../city/junctions'
import type { CityLayout } from '../city/layout'
import { AVENUE, SECTION, STREET } from '../city/streets'
import { smoothstep } from '../land/noise'
import { at, type P2, type P3 } from '../land/polyline'

/*
 * The city's traffic lanes as a directed graph, the same shape as the highway's: right-hand
 * lanes along every street segment, each ending at its junction's stop bar (where the lights
 * or the stop sign hold it), joined across the junction by curves into every street that
 * leads on. On avenues traffic keeps to the outer lane; a car turning left moves over into
 * the turn lane where the median gives way. No U-turns, no dead ends.
 */

/** The stop waypoint sits this far short of the bar, so a car stopping 4 m behind it noses up to the bar. */
const STOP_BACK = 1.3
const STEP = 4

type City = Pick<CityLayout, 'net' | 'junctions' | 'canal' | 'bridges'>

/** One way along a segment: from junction `from` to junction `to`. */
interface Way {
  seg: number
  fwd: boolean
  from: number
  to: number
}

type Turn = 'straight' | 'right' | 'left' | 'hairpin'
/** A lane variant: the maneuvers it serves at its far end. */
type Serves = 'through' | 'left' | 'all'

const ways = (c: City): Way[] =>
  c.net.segments.flatMap((s, seg) =>
    SECTION[s.kind].speed > 0
      ? [
          { seg, fwd: true, from: s.a, to: s.b },
          { seg, fwd: false, from: s.b, to: s.a },
        ]
      : [],
  )

const lineOf = (c: City, w: Way) =>
  w.fwd ? c.net.segments[w.seg].pts : [...c.net.segments[w.seg].pts].reverse()

/** Where a way's lane starts (past the junction it leaves) and ends (at the far stop bar). */
function span(c: City, w: Way): [number, number] {
  const len = segLength(c.net.segments[w.seg])
  const out = endOf(c.junctions, c.net, w.seg, w.fwd).mouth
  const arrive = endOf(c.junctions, c.net, w.seg, !w.fwd).mouth
  const control = c.junctions[w.to].control
  const held = control === 'signal' || control === 'stop'
  return [out, len - arrive - (held ? CROSSWALK.bar - STOP_BACK : 0)]
}

/** A lane from u0 to u1 along the line, `off(u)` meters to the driver's right, set on the road. */
function lane(c: City, line: P2[], u0: number, u1: number, off: (u: number) => number): P3[] {
  const n = Math.max(1, Math.ceil((u1 - u0) / STEP))
  return Array.from({ length: n + 1 }, (_, k) => {
    const u = u0 + ((u1 - u0) * k) / n
    const a = at(line, u - 0.5)
    const b = at(line, u + 0.5)
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const p = at(line, u)
    const x = p.x - ((b.z - a.z) / l) * off(u)
    const z = p.z + ((b.x - a.x) / l) * off(u)
    return { x, y: roadRise(c, x, z), z }
  })
}

/** The lane variants of a way: one per street; on avenues a through lane and, if needed, a left-turn lane. */
function variants(c: City, w: Way, hasLeft: boolean): { pts: P3[]; serves: Serves }[] {
  const [u0, u1] = span(c, w)
  if (u1 - u0 < 2 || c.junctions[w.to].control === 'end') return []
  const line = lineOf(c, w)
  const s = c.net.segments[w.seg]
  if (s.kind !== 'avenue') return [{ pts: lane(c, line, u0, u1, () => STREET.lane), serves: 'all' }]
  const outer = AVENUE.lanes[1]
  const held = c.junctions[w.to].control === 'signal' || c.junctions[w.to].control === 'stop'
  const out: { pts: P3[]; serves: Serves }[] = [
    { pts: lane(c, line, u0, u1, () => outer), serves: held ? 'through' : 'all' },
  ]
  if (held && hasLeft) {
    // Over into the turn lane once past the median's nose, by 10 m short of the stop bar.
    const lo = Math.max(u0 + 1, u1 - AVENUE.bay + 2)
    const hi = Math.max(lo + 6, u1 - 10)
    const off = (u: number) => outer + (AVENUE.turn - outer) * smoothstep(lo, hi, u)
    out.push({ pts: lane(c, line, u0, u1, off), serves: 'left' })
  }
  return out
}

/**
 * Which way the driver turns going from heading a to heading b (right is counterclockwise in
 * x, z). Back past 120 degrees, onto the diagonal at its sharp corners, is a hairpin: no turn.
 */
function turnOf(a: P2, b: P2): Turn {
  const cross = a.x * b.z - a.z * b.x
  const dot = a.x * b.x + a.z * b.z
  const ang = Math.atan2(cross, dot)
  if (Math.abs(ang) < 0.5) return 'straight'
  if (Math.abs(ang) > 2.1) return 'hairpin'
  return ang > 0 ? 'right' : 'left'
}

/** Where the line through p along unit d meets the line through q along unit e, or null. */
function meet(p: P2, d: P2, q: P2, e: P2): P2 | null {
  const den = d.x * e.z - d.z * e.x
  if (Math.abs(den) < 1e-3) return null
  const t = ((q.x - p.x) * e.z - (q.z - p.z) * e.x) / den
  return t > 0 ? { x: p.x + d.x * t, z: p.z + d.z * t } : null
}

const unit = (a: P2, b: P2) => {
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1
  return { x: (b.x - a.x) / l, z: (b.z - a.z) / l }
}

/** Points every ~2 m on a straight run or a quadratic curve through `ctrl`, set on the road. */
function curve(c: City, p: P2, ctrl: P2, q: P2): P3[] {
  const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 2))
  return Array.from({ length: n + 1 }, (_, i) => {
    const s = i / n
    const [k0, k1, k2] = [(1 - s) ** 2, 2 * s * (1 - s), s * s]
    const x = k0 * p.x + k1 * ctrl.x + k2 * q.x
    const z = k0 * p.z + k1 * ctrl.z + k2 * q.z
    return { x, y: roadRise(c, x, z), z }
  })
}

/**
 * A curve from the end of one lane to the start of the next through the junction. A right
 * turn hugs the curb on a radius of about 8 m, running straight up to it; other turns sweep
 * wide through where the two lane lines cross.
 */
function connector(c: City, a: P3[], b: P3[], turn: Turn): P3[] {
  const p = a[a.length - 1]
  const q = b[0]
  const da = unit(a[a.length - 2], p)
  const db = unit(q, b[1])
  const at = meet(p, da, q, { x: -db.x, z: -db.z })
  if (!at || turn === 'straight') return curve(c, p, { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }, q)
  if (turn !== 'right') return curve(c, p, at, q)
  const half = Math.acos(Math.max(-1, Math.min(1, da.x * db.x + da.z * db.z))) / 2
  const reach = Math.min(
    8 * Math.tan(half),
    Math.hypot(at.x - p.x, at.z - p.z),
    Math.hypot(q.x - at.x, q.z - at.z),
  )
  const p2 = { x: at.x - da.x * reach, z: at.z - da.z * reach }
  const q2 = { x: at.x + db.x * reach, z: at.z + db.z * reach }
  return [...curve(c, p, p, p2), ...curve(c, p2, at, q2).slice(1), ...curve(c, q2, q2, q).slice(1)]
}

export { ways, variants, turnOf, connector, lineOf }
export type { Way, Serves, City }
