import type { P2 } from '../land/polyline'
import type { Rect } from './layout'

/*
 * Plain polygon helpers for the city plan, in the ground plane (x, z). A ring is a closed
 * polygon without its first point repeated. Positive signed area means the inside lies to
 * the left of travel in math terms (x right, z up), which is how city faces are traced.
 */

export type Ring = P2[]

/** Shoelace area: positive for rings traced with the inside on the left (x right, z up). */
export function area(ring: Ring): number {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    a += p.x * q.z - q.x * p.z
  }
  return a / 2
}

export function centroid(ring: Ring): P2 {
  let x = 0
  let z = 0
  for (const p of ring) {
    x += p.x
    z += p.z
  }
  return { x: x / ring.length, z: z / ring.length }
}

/** Even-odd test: is p inside the ring? */
export function contains(ring: Ring, p: P2): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside
    }
  }
  return inside
}

export function bounds(ring: Ring): Rect {
  const r = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity }
  for (const p of ring) {
    r.x0 = Math.min(r.x0, p.x)
    r.x1 = Math.max(r.x1, p.x)
    r.z0 = Math.min(r.z0, p.z)
    r.z1 = Math.max(r.z1, p.z)
  }
  return r
}

const cross = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx

/** Where segments ab and cd cross: t along ab, u along cd (both 0..1 when they do), or null if parallel. */
export function crossing(a: P2, b: P2, c: P2, d: P2): { t: number; u: number; p: P2 } | null {
  const rx = b.x - a.x
  const rz = b.z - a.z
  const sx = d.x - c.x
  const sz = d.z - c.z
  const den = cross(rx, rz, sx, sz)
  if (Math.abs(den) < 1e-9) return null
  const t = cross(c.x - a.x, c.z - a.z, sx, sz) / den
  const u = cross(c.x - a.x, c.z - a.z, rx, rz) / den
  return { t, u, p: { x: a.x + rx * t, z: a.z + rz * t } }
}

/** Distance from p to segment ab. */
export function segDist(p: P2, a: P2, b: P2): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2))
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t)
}

/** Distance from p to the ring's boundary. */
export function edgeDist(ring: Ring, p: P2): number {
  let d = Infinity
  for (let i = 0; i < ring.length; i++)
    d = Math.min(d, segDist(p, ring[i], ring[(i + 1) % ring.length]))
  return d
}

/**
 * The ring moved `d` meters inward (positive area rings), corners mitered. Points whose
 * stretch turned backwards (a tight curve inset past its radius) are dropped.
 */
export function insetRing(ring: Ring, d: number): Ring {
  const n = ring.length
  const out: Ring = []
  for (let i = 0; i < n; i++) {
    const p = ring[(i + n - 1) % n]
    const q = ring[i]
    const s = ring[(i + 1) % n]
    out.push(miter(p, q, s, d))
  }
  return dropReversed(ring, out)
}

/** The point at q offset d to the left of both p->q and q->s. */
function miter(p: P2, q: P2, s: P2, d: number): P2 {
  const n1 = leftNormal(p, q)
  const n2 = leftNormal(q, s)
  const mx = n1.x + n2.x
  const mz = n1.z + n2.z
  const dot = mx * n1.x + mz * n1.z
  if (dot < 0.2) return { x: q.x + n2.x * d, z: q.z + n2.z * d }
  return { x: q.x + (mx / dot) * d, z: q.z + (mz / dot) * d }
}

export function leftNormal(a: P2, b: P2): P2 {
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1
  return { x: -(b.z - a.z) / l, z: (b.x - a.x) / l }
}

function dropReversed(src: Ring, out: Ring): Ring {
  const keep = out.filter((q, i) => {
    const j = (i + 1) % out.length
    const a = src[i]
    const b = src[j]
    return (out[j].x - q.x) * (b.x - a.x) + (out[j].z - q.z) * (b.z - a.z) > 0
  })
  return keep.length >= 3 ? keep : out
}

/** The part of a convex-or-not ring on the left of the directed line ab (Sutherland-Hodgman). */
export function clipLeft(ring: Ring, a: P2, b: P2): Ring {
  const side = (p: P2) => cross(b.x - a.x, b.z - a.z, p.x - a.x, p.z - a.z)
  const out: Ring = []
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    const sp = side(p)
    const sq = side(q)
    if (sp >= 0) out.push(p)
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq)
      out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t })
    }
  }
  return out
}

/** The ring cut to an axis-aligned rect. */
export function clipRect(ring: Ring, r: Rect): Ring {
  let out = ring
  const corners = [
    { x: r.x0, z: r.z0 },
    { x: r.x1, z: r.z0 },
    { x: r.x1, z: r.z1 },
    { x: r.x0, z: r.z1 },
  ]
  for (let i = 0; i < 4 && out.length; i++) out = clipLeft(out, corners[i], corners[(i + 1) % 4])
  return out
}

export const rectRing = (r: Rect): Ring => [
  { x: r.x0, z: r.z0 },
  { x: r.x1, z: r.z0 },
  { x: r.x1, z: r.z1 },
  { x: r.x0, z: r.z1 },
]

/** True if the rect lies wholly inside the ring: corners in, and no ring edge cuts a rect edge. */
export function rectInside(r: Rect, ring: Ring): boolean {
  const box = rectRing(r)
  if (!box.every((p) => contains(ring, p))) return false
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    for (let k = 0; k < 4; k++) {
      const x = crossing(a, b, box[k], box[(k + 1) % 4])
      if (x && x.t > 1e-6 && x.t < 1 - 1e-6 && x.u > 1e-6 && x.u < 1 - 1e-6) return false
    }
  }
  return true
}

/** True if the rects overlap by more than a sliver. */
export const overlaps = (a: Rect, b: Rect, by = 0) =>
  a.x0 < b.x1 - by && b.x0 < a.x1 - by && a.z0 < b.z1 - by && b.z0 < a.z1 - by
