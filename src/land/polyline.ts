/** Plain 2D and 3D polyline helpers for roads: x/z in the ground plane, y up. */

export type P2 = { x: number; z: number }
export type P3 = { x: number; y: number; z: number }

export const dist = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.z - b.z)

/** Points along a circular arc around (cx, cz), from angle a0 to a1 (radians, 0 = +x, pi/2 = +z). */
export function arc(cx: number, cz: number, r: number, a0: number, a1: number, step = 4): P2[] {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / step))
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return { x: cx + r * Math.cos(a), z: cz + r * Math.sin(a) }
  })
}

/** Joins point runs, dropping a point that repeats the previous run's last one. */
export function chain(...runs: P2[][]): P2[] {
  const out: P2[] = []
  for (const run of runs) {
    for (const p of run) if (!out.length || dist(out[out.length - 1], p) > 0.01) out.push(p)
  }
  return out
}

/** Even spacing of about `step` meters along the line, keeping both ends. */
export function resample<T extends P2>(pts: T[], step: number): P2[] {
  const out: P2[] = [{ x: pts[0].x, z: pts[0].z }]
  const total = length(pts)
  const n = Math.max(1, Math.round(total / step))
  for (let i = 1; i <= n; i++) out.push(at(pts, (total * i) / n))
  return out
}

export function length(pts: P2[]): number {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i])
  return d
}

/** Cumulative distance at each point. */
export function stations(pts: P2[]): number[] {
  const s = [0]
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + dist(pts[i - 1], pts[i]))
  return s
}

/** The point `s` meters along the line (clamped to its ends). */
export function at(pts: P2[], s: number): P2 {
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i])
    if (s <= d || i === pts.length - 1) {
      const t = d > 0 ? Math.min(1, Math.max(0, s / d)) : 0
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t,
      }
    }
    s -= d
  }
  return { ...pts[0] }
}

/** Unit direction of travel at point i, from its neighbours. */
export function tangent(pts: P2[], i: number): P2 {
  const a = pts[Math.max(0, i - 1)]
  const b = pts[Math.min(pts.length - 1, i + 1)]
  const d = dist(a, b) || 1
  return { x: (b.x - a.x) / d, z: (b.z - a.z) / d }
}

/** Points shifted sideways by `by` meters; positive is to the right of travel (yaw 0 faces +z, right is -x). */
export function offset<T extends P2>(pts: T[], by: number): T[] {
  return pts.map((p, i) => {
    const t = tangent(pts, i)
    return { ...p, x: p.x - t.z * by, z: p.z + t.x * by }
  })
}

/** Nearest point on the line to p: distance, station, and segment index. */
export function closest(pts: P2[], p: P2): { d: number; s: number; i: number; at: P2 } {
  let best = { d: Infinity, s: 0, i: 0, at: pts[0] }
  let s0 = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const len = dist(a, b)
    const t = len
      ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / len ** 2))
      : 0
    const q = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
    const d = dist(p, q)
    if (d < best.d) best = { d, s: s0 + t * len, i: i - 1, at: q }
    s0 += len
  }
  return best
}

/** Linear interpolation of per-point values at station s. */
export function valueAt(st: number[], v: number[], s: number): number {
  if (s <= st[0]) return v[0]
  for (let i = 1; i < st.length; i++) {
    if (s <= st[i])
      return v[i - 1] + ((v[i] - v[i - 1]) * (s - st[i - 1])) / (st[i] - st[i - 1] || 1)
  }
  return v[v.length - 1]
}

/** A smooth curve through the control points (Catmull-Rom), sampled about every `step` meters. */
export function spline(ctrl: P2[], step = 4): P2[] {
  const out: P2[] = []
  for (let i = 0; i + 1 < ctrl.length; i++) {
    const [p0, p1, p2, p3] = [
      ctrl[Math.max(0, i - 1)],
      ctrl[i],
      ctrl[i + 1],
      ctrl[Math.min(ctrl.length - 1, i + 2)],
    ]
    const n = Math.max(2, Math.ceil(dist(p1, p2) / step))
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (c - a) * t +
          (2 * a - 5 * b + 4 * c - d) * t * t +
          (3 * b - a - 3 * c + d) * t ** 3)
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) })
    }
  }
  return out
}
