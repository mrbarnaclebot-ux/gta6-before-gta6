import type { Block, Face, Rect } from './layout'
import type { Network } from './network'
import { runs, spaced, type Run } from './curbs'
import { area, bounds, centroid, contains, insetRing, rectRing, type Ring } from './polygon'
import { range, type Rand } from './rng'
import type { Median } from './medians'
import { at, length } from '../land/polyline'

/**
 * A placed prop: position, size (height in meters, or scale), and yaw. Once set on the
 * ground (land/footing.ts) it also has its base height, and maybe a tilt and a tint.
 */
export interface Spot {
  x: number
  z: number
  s: number
  r: number
  y?: number
  /** Unit up vector, for things that lie with the ground. */
  up?: [number, number, number]
  /** Color multiplier as 0xRRGGBB. */
  tint?: number
}

/** A spot already set on the ground: only these get drawn. */
export type Grounded = Spot & { y: number }

interface Plan {
  blocks: Block[]
  walks: Face[]
  islands: Face[]
  /** Lawn strips in the beach promenade. */
  promenade: Ring[]
  medians: Median[]
  land: Rect
  net: Network
}

const palm = (r: Rand, p: { x: number; z: number }, lo = 8, hi = 13): Spot => ({
  x: p.x,
  z: p.z,
  s: range(r, lo, hi),
  r: r() * Math.PI * 2,
})

/** Plazas bigger than this get palms in planters, on a grid this many meters apart. */
export const PLAZA_PALM = 150
const PLAZA_GRID = 9

/** Where the palms in planters stand in a plaza: a grid clear of its edges. */
export function plazaTrees(plaza: Ring): { x: number; z: number }[] {
  if (area(plaza) < PLAZA_PALM) return []
  const inner = insetRing(plaza, 2.5)
  const b = bounds(plaza)
  const nx = Math.max(1, Math.floor((b.x1 - b.x0) / PLAZA_GRID))
  const nz = Math.max(1, Math.floor((b.z1 - b.z0) / PLAZA_GRID))
  const out: { x: number; z: number }[] = []
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const p = {
        x: b.x0 + ((i + 0.5) * (b.x1 - b.x0)) / nx,
        z: b.z0 + ((j + 0.5) * (b.z1 - b.z0)) / nz,
      }
      if (contains(inner, p)) out.push(p)
    }
  }
  return out.length ? out.slice(0, 12) : [centroid(plaza)]
}

/** `n` random spots inside a ring. */
export function scatter(r: Rand, ring: Ring, n: number, lo: number, hi: number): Spot[] {
  const box = bounds(ring)
  const out: Spot[] = []
  for (let tries = 0; out.length < n && tries < n * 20; tries++) {
    const p = { x: range(r, box.x0, box.x1), z: range(r, box.z0, box.z1) }
    if (contains(ring, p)) out.push(palm(r, p, lo, hi))
  }
  return out
}

/** The street line a run faces, by name. */
const lineOf = (net: Network, run: Run) => net.lines[net.segments[run.seg].line].name

/** Row spacing for palms along a run of this block's curb, or 0 for none. */
function palmRow(b: Block, run: Run, net: Network, r: Rand): number {
  if (run.kind === 'canal') return 16
  if (run.kind === 'avenue') return lineOf(net, run) === 'coast road' ? 15 : 19
  if (run.kind !== 'street') return 0
  if (b.district === 'deco') return 18
  return b.district === 'midtown' && r() < 0.5 ? 22 : 0
}

function blockPalms(b: Block, net: Network, r: Rand): Spot[] {
  const out: Spot[] = []
  for (const run of runs(b)) {
    const gap = palmRow(b, run, net, r)
    if (gap && run.length > 12) out.push(...spaced(run, gap, 2).map((p) => palm(r, p)))
  }
  if (b.park) out.push(...scatter(r, insetRing(b.lot, 3), 16, 7, 13))
  for (const g of b.gardens)
    out.push(...scatter(r, insetRing(g, 2.5), 1 + Math.floor(r() * 3), 6, 11))
  // Hotel decks hold pools (world/lots.ts), so only other plazas get a palm in a planter.
  if (b.district !== 'beachfront') {
    for (const p of b.plazas) out.push(...plazaTrees(p).map((t) => palm(r, t, 7, 11)))
  }
  return out
}

/** A row of palms down a median, about 14 m apart, clear of its noses. */
function medianPalms(m: Median, r: Rand): Spot[] {
  const len = length(m.line)
  const n = Math.floor((len - 6) / 14)
  return Array.from({ length: n }, (_, k) =>
    palm(r, at(m.line, 3 + ((k + 0.5) * (len - 6)) / n), 9, 13),
  )
}

/** Two rows of palms on the sand along the beach. */
function beachPalms(land: Rect, r: Rand): Spot[] {
  const out: Spot[] = []
  for (const [dx, spacing] of [
    [6, 13],
    [24, 19],
  ]) {
    for (let z = land.z0 + spacing / 2; z < land.z1; z += spacing) {
      out.push(palm(r, { x: land.x1 + dx + range(r, -2, 2), z: z + range(r, -3, 3) }, 9, 14))
    }
  }
  return out
}

/** Street lamps along every curb run but the canal's, the city's edge, and the alleys. */
function lights(faces: Face[]): Spot[] {
  return faces.flatMap((f) =>
    runs(f)
      .filter((run) => (run.kind === 'avenue' || run.kind === 'street') && run.length >= 20)
      .flatMap((run) => spaced(run, 34, 0.8).map((p) => ({ x: p.x, z: p.z, s: 1, r: p.yaw }))),
  )
}

/** Palms, bushes, and streetlights for the whole plan, all on sidewalks, lawns, islands, or sand. */
export function greenery(plan: Plan, r: Rand) {
  const { blocks, walks, islands, promenade, medians, land, net } = plan
  const parks = blocks.filter((b) => b.park).map((b) => insetRing(b.lot, 2))
  const sand = { x0: land.x1 + 10, z0: land.z0, x1: land.x1 + 18, z1: land.z1 }
  return {
    palms: [
      ...blocks.flatMap((b) => blockPalms(b, net, r)),
      ...beachPalms(land, r),
      ...promenade.flatMap((l) => scatter(r, insetRing(l, 2), Math.round(area(l) / 260), 8, 14)),
      ...islands.filter((f) => area(f.curb) > 90).map((f) => palm(r, centroid(f.curb), 6, 10)),
      ...medians.flatMap((m) => medianPalms(m, r)),
    ],
    bushes: [
      ...parks.flatMap((p) => scatter(r, p, 24, 0.8, 1.6)),
      ...blocks.flatMap((b) =>
        b.gardens.flatMap((g) => scatter(r, insetRing(g, 1.5), 3, 0.8, 1.6)),
      ),
      ...islands.flatMap((f) => scatter(r, insetRing(f.curb, 1.2), 2, 0.6, 1.2)),
      ...scatter(r, rectRing(sand), Math.round((land.z1 - land.z0) / 9), 0.8, 1.8),
    ],
    lights: lights([...blocks, ...walks]),
  }
}
