import type { Rect } from '../city/layout'
import { smoothstep } from './noise'
import { lift, path, type Path } from './path'
import { arc, chain, closest, resample, stations, tangent, type P2, type P3 } from './polyline'
import { clampGrade, profile } from './profile'

/*
 * The highway: a divided four-lane road shaped like a U opening to the sea. It leaves
 * the north beach, runs west past the city, south along the city's west side, and back
 * east to the south beach, with a turnaround loop at each end. Where it crosses Hill
 * Road and Palm Avenue it climbs onto a bridge (a diamond interchange with four ramps).
 */

export const EAST_X = -640
export const LEG_Z = 640
export const CORNER_R = 220
/** Turnaround loops by the beaches, at the north and south ends. */
export const TERMINAL = { x: 350, r: 26 }
/** Lane centers from the highway's centerline, inner and outer; the outer one carries traffic. */
export const LANES = [3.1, 6.7]
/** Bridge deck height over the crossing road, and where the climb starts and the deck levels off. */
export const BUMP = { height: 6.4, flat: 60, ramp: 175 }
/** Ramps leave and rejoin this far before and after the crossing; they sit this far out. */
export const RAMP = { reach: 290, out: 34, taper: 130, gap: 5 }
/** Steepest grade on the highway and its ramps. */
export const MAX_GRADE = 0.06
/** Over a waterway the deck's surface stands this high, level this far either side, easing over `ramp`. */
export const OVER_WATER = { height: 5.6, flat: 30, ramp: 120 }

type Ground = (x: number, z: number) => number

/** Outbound centerline: north beach, west, down the city's west side, east to the south beach. */
export function centerline(): P2[] {
  const r = CORNER_R
  const start = TERMINAL.x - TERMINAL.r
  return resample(
    chain(
      [{ x: start, z: -LEG_Z }],
      arc(EAST_X + r, -LEG_Z + r, r, -Math.PI / 2, -Math.PI),
      arc(EAST_X + r, LEG_Z - r, r, Math.PI, Math.PI / 2),
      [{ x: start, z: LEG_Z }],
    ),
    4,
  )
}

/** Cosine ease from 0 to 1 and back: the climb onto the bridge, level across it. */
export function bump(ds: number): number {
  const d = Math.abs(ds)
  if (d <= BUMP.flat) return 1
  const t = Math.min(1, (d - BUMP.flat) / BUMP.ramp)
  return 0.5 + 0.5 * Math.cos(Math.PI * t)
}

export interface Crossing {
  /** Where the crossing road meets the highway's line, and its height there. */
  at: P2
  y: number
}

/** The highway's height: smoothed ground, level through each interchange, a bridge over each crossing. */
function heights(
  pts: P2[],
  ground: Ground,
  ends: number[],
  crossings: Crossing[],
  waters: P2[],
): number[] {
  const st = stations(pts)
  const y = profile(pts, ground, { grade: 0.03, window: 400, start: ends[0], end: ends[1] })
  for (const w of waters) {
    const sc = closest(pts, w).s
    st.forEach((s, i) => {
      const d = Math.max(0, Math.abs(s - sc) - OVER_WATER.flat) / OVER_WATER.ramp
      const k = d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d)
      y[i] += Math.max(0, OVER_WATER.height - y[i]) * k
    })
  }
  for (const c of crossings) {
    const sc = closest(pts, c.at).s
    const zone = RAMP.reach + 10
    const i0 = st.findIndex((s) => s >= sc - zone)
    const i1 = st.findIndex((s) => s >= sc + zone)
    const [y0, y1] = [y[i0], y[i1]]
    for (let i = i0; i <= i1; i++) {
      const s = st[i]
      const base =
        s < sc
          ? y0 + ((c.y - y0) * (s - st[i0])) / (sc - st[i0])
          : c.y + ((y1 - c.y) * (s - sc)) / (st[i1] - sc)
      y[i] = base + BUMP.height * bump(s - sc)
    }
  }
  clampGrade(st, y, MAX_GRADE)
  return y
}

/** Height on the highway's centerline at the station nearest p. */
export function heightNear(hw: Path, p: P2): number {
  return hw.pts[closest(hw.pts, p).i].y
}

/** One ramp between station s0 and s1 (in travel order), easing its sideways offset from a to b. */
function ramp(
  hw: P3[],
  st: number[],
  s0: number,
  s1: number,
  lat: [number, number],
  easeAtStart: boolean,
): P2[] {
  const out: P2[] = []
  const n = Math.max(2, Math.round(Math.abs(s1 - s0) / 4))
  for (let k = 0; k <= n; k++) {
    const s = s0 + ((s1 - s0) * k) / n
    const i = Math.max(
      0,
      st.findIndex((v) => v >= s),
    )
    const t = tangent(hw, i)
    const along = Math.abs(s - s0)
    const span = Math.abs(s1 - s0)
    const e = easeAtStart
      ? smoothstep(0, RAMP.taper, along)
      : 1 - smoothstep(span - RAMP.taper, span, along)
    const off = lat[0] + (lat[1] - lat[0]) * (easeAtStart ? e : 1 - e)
    const c = hw[i]
    const f = s - st[i]
    out.push({ x: c.x + t.x * f - t.z * off, z: c.z + t.z * f + t.x * off })
  }
  return out
}

/** The four ramps of one diamond interchange, each running in its direction of travel. */
function diamond(
  hw: Path,
  st: number[],
  c: Crossing,
  ground: Ground,
  crossY: (p: P2) => number,
): Path[] {
  const sc = closest(hw.pts, c.at).s
  const { reach, out, gap } = RAMP
  const [lane] = LANES.slice(1)
  const specs: [string, number, number, [number, number], boolean][] = [
    ['off out', sc - reach, sc - gap, [lane, out], true],
    ['on out', sc + gap, sc + reach, [out, lane], false],
    ['off in', sc + reach, sc + gap, [-lane, -out], true],
    ['on in', sc - gap, sc - reach, [-out, -lane], false],
  ]
  return specs.map(([name, s0, s1, lat, easeStart]) => {
    const pts = ramp(hw.pts, st, s0, s1, lat, easeStart)
    const onHw = easeStart ? pts[0] : pts[pts.length - 1]
    const onRoad = easeStart ? pts[pts.length - 1] : pts[0]
    const hy = heightNear(hw, onHw)
    const ry = crossY(onRoad)
    const y = profile(pts, ground, {
      grade: MAX_GRADE,
      window: 80,
      start: easeStart ? hy : ry,
      end: easeStart ? ry : hy,
    })
    return path(`ramp ${name} ${Math.round(c.at.z)}`, 'ramp', lift(pts, y))
  })
}

/**
 * The highway, its ramps, the two turnaround loops, and the coast roads from the city's
 * beach road to them. `crossY` gives the crossing roads' height at a point.
 */
export function buildHighway(
  ground: Ground,
  crossings: Crossing[],
  crossY: (p: P2) => number,
  beachRoadX: number,
  cityEdge: number,
  /** Walled channels the highway bridges, high enough for a boat to pass under. */
  waters: Rect[],
): Path[] {
  const ends = [-1, 1].map((s) => ground(TERMINAL.x, s * LEG_Z))
  const line = centerline()
  const spans = waters.map((r) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }))
  const hw = path('highway', 'highway', lift(line, heights(line, ground, ends, crossings, spans)))
  const st = stations(hw.pts)
  const loops = [-1, 1].map((s, k) =>
    path(
      `loop ${s}`,
      'loop',
      lift(arc(TERMINAL.x, s * LEG_Z, TERMINAL.r, 0, Math.PI * 2).slice(0, -1), ends[k]),
      true,
    ),
  )
  const coast = [-1, 1].map((s, k) => {
    const pts = resample(
      [
        { x: beachRoadX, z: s * cityEdge },
        { x: beachRoadX, z: s * (LEG_Z - TERMINAL.r) },
      ],
      4,
    )
    return path(
      `coast ${s}`,
      'coast',
      lift(pts, profile(pts, ground, { grade: 0.05, window: 60, start: 0, end: ends[k] })),
    )
  })
  const ramps = crossings.flatMap((c) => diamond(hw, st, c, ground, crossY))
  return [hw, ...ramps, ...loops, ...coast]
}
