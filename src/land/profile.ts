import { stations, type P2 } from './polyline'

export interface ProfileOptions {
  /** Steepest grade allowed, rise over run. */
  grade: number
  /** Moving-average window in meters: how much small bumps are ironed out. */
  window: number
  /** Heights the ends must meet exactly, such as the road they join. */
  start?: number
  end?: number
}

/** Moving average over about `window` meters of road. */
function smooth(st: number[], y: number[], window: number): number[] {
  return y.map((_, i) => {
    let j0 = i
    let j1 = i
    while (j0 > 0 && st[i] - st[j0 - 1] <= window / 2) j0--
    while (j1 < y.length - 1 && st[j1 + 1] - st[i] <= window / 2) j1++
    let sum = 0
    for (let j = j0; j <= j1; j++) sum += y[j]
    return sum / (j1 - j0 + 1)
  })
}

/** Shifts the profile so an end meets `to`, fading the shift out over `span` meters. */
function pin(st: number[], y: number[], to: number | undefined, fromEnd: boolean, span: number) {
  if (to === undefined) return
  const last = st[st.length - 1]
  const k0 = fromEnd ? y.length - 1 : 0
  const shift = to - y[k0]
  y.forEach((_, i) => {
    const d = fromEnd ? last - st[i] : st[i]
    y[i] += shift * Math.max(0, 1 - d / span)
  })
}

/**
 * Caps the grade between neighbours. Pinned ends never move; alternating forward and
 * backward passes then pull the rest into a profile that reaches both of them.
 */
export function clampGrade(
  st: number[],
  y: number[],
  grade: number,
  pinned = { start: false, end: false },
): void {
  const n = y.length
  const near = (i: number, j: number) => {
    const g = grade * Math.abs(st[i] - st[j])
    y[i] = Math.min(y[j] + g, Math.max(y[j] - g, y[i]))
  }
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 1; i < (pinned.end ? n - 1 : n); i++) near(i, i - 1)
    for (let i = n - 2; i >= (pinned.start ? 1 : 0); i--) near(i, i + 1)
  }
}

/**
 * A drivable height for each point: the ground smoothed, ends pinned to the roads
 * they join, and no stretch steeper than `grade`. Terrain is later cut and filled to it.
 */
export function profile(pts: P2[], ground: (x: number, z: number) => number, o: ProfileOptions) {
  const st = stations(pts)
  const y = smooth(
    st,
    pts.map((p) => ground(p.x, p.z)),
    o.window,
  )
  const span = Math.min(st[st.length - 1] / 2, o.window)
  pin(st, y, o.start, false, span)
  pin(st, y, o.end, true, span)
  clampGrade(st, y, o.grade, { start: o.start !== undefined, end: o.end !== undefined })
  return y
}

/** Largest grade between neighbouring points. */
export function maxGrade(pts: { x: number; y: number; z: number }[]): number {
  let g = 0
  for (let i = 1; i < pts.length; i++) {
    const run = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
    if (run > 0.5) g = Math.max(g, Math.abs(pts[i].y - pts[i - 1].y) / run)
  }
  return g
}
