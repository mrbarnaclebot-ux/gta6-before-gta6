import type { Rect } from '../city/layout'
import { fbm } from './noise'
import { stations, type P2 } from './polyline'

/*
 * The island's coastline: a hand-placed outline, smoothed and given a seeded wobble, baked
 * once into a raster of signed distance (positive seaward) and how sandy the nearest shore
 * is. The line is the top of the shore: the back of the beach, or the edge of the rocks.
 */

/** A control point: where, how sandy (1 beach, 0 rock), and how much the seeded wobble moves it. */
type Ctrl = [x: number, z: number, sand: number, wobble: number]

// Clockwise on the map from the city's beach. The east shore and the canal mouths stay put.
const OUTLINE: Ctrl[] = [
  [366, 0, 1, 0],
  [366, 560, 1, 0],
  [374, 610, 1, 0],
  [392, 652, 1, 0.3],
  [366, 690, 1, 0.4],
  [290, 694, 1, 0.5],
  [190, 686, 1, 0.4],
  [110, 678, 0.5, 0.1],
  [70, 674, 0.1, 0],
  [30, 674, 0.1, 0],
  [-40, 672, 0, 0.1],
  [-200, 670, 0, 0.2],
  [-360, 672, 0, 0.2],
  [-470, 686, 0, 0.3],
  [-570, 712, 0.3, 0.4],
  [-680, 770, 0.7, 0.6],
  [-830, 860, 1, 0.6],
  [-990, 925, 1, 0.6],
  [-1140, 950, 1, 0.3],
  [-1300, 948, 1, 0.6],
  [-1450, 905, 0.9, 0.6],
  [-1570, 850, 0.3, 0.6],
  [-1690, 760, 0, 0.8],
  [-1785, 640, 0, 0.8],
  [-1765, 520, 0, 0.7],
  [-1690, 430, 0.4, 0.5],
  [-1645, 300, 1, 0.5],
  [-1630, 150, 1, 0.4],
  [-1660, 0, 1, 0.4],
  [-1710, -120, 0.6, 0.5],
  [-1785, -215, 0, 0.8],
  [-1825, -320, 0, 0.8],
  [-1770, -440, 0, 0.8],
  [-1690, -525, 0.2, 0.6],
  [-1650, -650, 0.6, 0.6],
  [-1600, -775, 0.6, 0.6],
  [-1500, -880, 0.2, 0.6],
  [-1380, -960, 0, 0.6],
  [-1250, -1000, 0, 0.6],
  [-1100, -985, 0, 0.6],
  [-985, -925, 0.2, 0.6],
  [-885, -810, 0.8, 0.5],
  [-780, -712, 1, 0.5],
  [-680, -672, 1, 0.4],
  [-580, -684, 0.6, 0.3],
  [-480, -690, 0.2, 0.2],
  [-400, -678, 0, 0.2],
  [-250, -672, 0, 0.2],
  [-60, -672, 0, 0.1],
  [30, -674, 0.1, 0],
  [70, -674, 0.1, 0],
  [110, -678, 0.5, 0.1],
  [200, -686, 1, 0.4],
  [300, -694, 1, 0.5],
  [368, -690, 1, 0.4],
  [392, -652, 1, 0.3],
  [374, -610, 1, 0],
  [366, -560, 1, 0],
]

const WOBBLE = 22
const SEED = 31
export const COAST_CELL = 8
/** Distances are exact to this far from the line, then carried on by a chamfer. */
const PAD = 120

export interface CoastField {
  x0: number
  z0: number
  w: number
  h: number
  /** Signed meters from the coast line, positive seaward. */
  d: Float32Array
  /** 0 (rock) to 1 (sand): the nearest shore. */
  sand: Float32Array
  /** The smoothed outline, closed (the last point repeats the first). */
  line: P2[]
}

/** Catmull-Rom through the closed ring of control points, about every 8 m, with each point's sand and wobble. */
function ring(): { p: P2; sand: number; wobble: number }[] {
  const n = OUTLINE.length
  const out: { p: P2; sand: number; wobble: number }[] = []
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((k) => OUTLINE[(i + k + n) % n])
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 8))
    for (let k = 0; k < steps; k++) {
      const t = k / steps
      const f = (c: number) =>
        0.5 *
        (2 * p1[c] +
          (p2[c] - p0[c]) * t +
          (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t +
          (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t ** 3)
      const lerp = (c: number) => p1[c] + (p2[c] - p1[c]) * t
      out.push({ p: { x: f(0), z: f(1) }, sand: lerp(2), wobble: lerp(3) })
    }
  }
  return out
}

/** The outline smoothed through its control points and wobbled by seeded noise, closed. */
export function coastLine(): { line: P2[]; sand: number[] } {
  const pts = ring()
  const st = stations([...pts.map((q) => q.p), pts[0].p])
  const line = pts.map((q, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length].p
    const b = pts[(i + 1) % pts.length].p
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const shift = WOBBLE * q.wobble * fbm(st[i] / 190, 0.5, SEED, 3)
    return { x: q.p.x + ((b.z - a.z) / len) * shift, z: q.p.z - ((b.x - a.x) / len) * shift }
  })
  return { line: [...line, line[0]], sand: [...pts.map((q) => q.sand), pts[0].sand] }
}

/** Where the outline crosses the row z, sorted: inside lies between pairs (even-odd). */
function crossings(line: P2[], z: number): number[] {
  const xs: number[] = []
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]
    const b = line[i]
    if (a.z > z !== b.z > z) xs.push(a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z))
  }
  return xs.sort((p, q) => p - q)
}

/** Exact distance (and the shore's sand) from every segment to the cells within PAD of it. */
function stamp(c: CoastField, lineSand: number[]): void {
  const { line, d, sand, w, h } = c
  for (let i = 1; i < line.length; i++) {
    const [p, q] = [line[i - 1], line[i]]
    const len2 = (q.x - p.x) ** 2 + (q.z - p.z) ** 2 || 1
    const i0 = Math.max(0, Math.floor((Math.min(p.x, q.x) - PAD - c.x0) / COAST_CELL))
    const i1 = Math.min(w - 1, Math.ceil((Math.max(p.x, q.x) + PAD - c.x0) / COAST_CELL))
    const j0 = Math.max(0, Math.floor((Math.min(p.z, q.z) - PAD - c.z0) / COAST_CELL))
    const j1 = Math.min(h - 1, Math.ceil((Math.max(p.z, q.z) + PAD - c.z0) / COAST_CELL))
    for (let j = j0; j <= j1; j++) {
      for (let ii = i0; ii <= i1; ii++) {
        const x = c.x0 + ii * COAST_CELL
        const z = c.z0 + j * COAST_CELL
        const t = Math.max(
          0,
          Math.min(1, ((x - p.x) * (q.x - p.x) + (z - p.z) * (q.z - p.z)) / len2),
        )
        const dist = Math.hypot(x - p.x - (q.x - p.x) * t, z - p.z - (q.z - p.z) * t)
        const k = j * w + ii
        if (dist >= d[k]) continue
        d[k] = dist
        sand[k] = lineSand[i - 1] + (lineSand[i] - lineSand[i - 1]) * t
      }
    }
  }
}

/** Carries distance (and sand) on past the stamped band with a two-pass chamfer. */
function spread(c: CoastField): void {
  const { d, sand, w, h } = c
  const relax = (k: number, i: number, j: number, di: number, dj: number, cost: number) => {
    if (i + di < 0 || j + dj < 0 || i + di >= w || j + dj >= h) return
    const n = (j + dj) * w + i + di
    if (d[n] + cost < d[k]) {
      d[k] = d[n] + cost
      sand[k] = sand[n]
    }
  }
  const [a, b] = [COAST_CELL, COAST_CELL * Math.SQRT2]
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      relax(k, i, j, -1, 0, a)
      relax(k, i, j, 0, -1, a)
      relax(k, i, j, -1, -1, b)
      relax(k, i, j, 1, -1, b)
    }
  }
  for (let j = h - 1; j >= 0; j--) {
    for (let i = w - 1; i >= 0; i--) {
      const k = j * w + i
      relax(k, i, j, 1, 0, a)
      relax(k, i, j, 0, 1, a)
      relax(k, i, j, 1, 1, b)
      relax(k, i, j, -1, 1, b)
    }
  }
}

/** Bakes the coast raster over `r` (the terrain grid). */
export function bakeCoast(r: Rect): CoastField {
  const { line, sand: lineSand } = coastLine()
  const w = Math.ceil((r.x1 - r.x0) / COAST_CELL) + 1
  const h = Math.ceil((r.z1 - r.z0) / COAST_CELL) + 1
  const c: CoastField = {
    ...{ x0: r.x0, z0: r.z0, w, h, line },
    d: new Float32Array(w * h).fill(1e6),
    sand: new Float32Array(w * h).fill(1),
  }
  stamp(c, lineSand)
  spread(c)
  for (let j = 0; j < h; j++) {
    const xs = crossings(line, r.z0 + j * COAST_CELL)
    for (let i = 0, n = 0; i < w; i++) {
      while (n < xs.length && xs[n] < r.x0 + i * COAST_CELL) n++
      if (n % 2) c.d[j * w + i] *= -1
    }
  }
  return c
}

/** Bilinear read of one channel; clamped at the raster's edge. */
function read(c: CoastField, a: Float32Array, x: number, z: number): number {
  const fx = Math.min(c.w - 1.001, Math.max(0, (x - c.x0) / COAST_CELL))
  const fz = Math.min(c.h - 1.001, Math.max(0, (z - c.z0) / COAST_CELL))
  const i = Math.floor(fx)
  const j = Math.floor(fz)
  const tx = fx - i
  const tz = fz - j
  const k = j * c.w + i
  const top = a[k] + (a[k + 1] - a[k]) * tx
  const bottom = a[k + c.w] + (a[k + c.w + 1] - a[k + c.w]) * tx
  return top + (bottom - top) * tz
}

/** Meters seaward of the coast line at (x, z): negative inland. Past the raster it keeps growing. */
export function seaward(c: CoastField, x: number, z: number): number {
  const out = Math.hypot(
    Math.max(0, c.x0 - x, x - (c.x0 + (c.w - 1) * COAST_CELL)),
    Math.max(0, c.z0 - z, z - (c.z0 + (c.h - 1) * COAST_CELL)),
  )
  return read(c, c.d, x, z) + out
}

/** 0 (rocky) to 1 (sandy): the shore nearest (x, z). */
export const sandAt = (c: CoastField, x: number, z: number) => read(c, c.sand, x, z)
