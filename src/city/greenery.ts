import { inset, type Block, type Rect } from './layout'
import { range, type Rand } from './rng'

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
  walks: Rect[]
  land: Rect
}

type Edge = 'x0' | 'x1' | 'z0' | 'z1'
const EDGES: Edge[] = ['x0', 'x1', 'z0', 'z1']
/** Yaw that faces out of the rect across each edge (toward the road). */
const OUTWARD: Record<Edge, number> = { x0: -Math.PI / 2, x1: Math.PI / 2, z0: Math.PI, z1: 0 }

/** Evenly spaced points along one edge of a rect, `inward` meters inside it. */
function alongEdge(rect: Rect, edge: Edge, spacing: number, inward: number) {
  const alongX = edge[0] === 'z'
  const from = alongX ? rect.x0 : rect.z0
  const len = alongX ? rect.x1 - rect.x0 : rect.z1 - rect.z0
  const n = Math.max(1, Math.floor(len / spacing))
  const sign = edge[1] === '0' ? 1 : -1
  const fixed = rect[edge] + sign * inward
  return Array.from({ length: n }, (_, k) => {
    const t = from + ((k + 0.5) * len) / n
    return alongX ? { x: t, z: fixed } : { x: fixed, z: t }
  })
}

const palm = (r: Rand, p: { x: number; z: number }, lo = 8, hi = 13): Spot => ({
  ...p,
  s: range(r, lo, hi),
  r: r() * Math.PI * 2,
})

function scatter(r: Rand, area: Rect, n: number, lo: number, hi: number): Spot[] {
  return Array.from({ length: n }, () =>
    palm(r, { x: range(r, area.x0, area.x1), z: range(r, area.z0, area.z1) }, lo, hi),
  )
}

function blockPalms(b: Block, r: Rand): Spot[] {
  const out: Spot[] = []
  const add = (edge: Edge, spacing: number) =>
    out.push(...alongEdge(b.rect, edge, spacing, 2).map((p) => palm(r, p)))
  if (b.canalSide) add(b.canalSide === 'east' ? 'x1' : 'x0', 16)
  if (b.district === 'beachfront') add('x1', 15)
  if (b.district === 'deco' && !b.canalSide) (['z0', 'z1'] as Edge[]).forEach((e) => add(e, 18))
  if (b.district === 'midtown' && r() < 0.5) add('z1', 22)
  if (b.park) out.push(...scatter(r, inset(b.lot, 3), 16, 7, 13))
  for (const g of b.gardens) out.push(...scatter(r, inset(g, 2.5), 1 + Math.floor(r() * 3), 6, 11))
  return out
}

function beachPalms(land: Rect, r: Rand): Spot[] {
  const rows: [number, number][] = [
    [6, 13],
    [24, 19],
  ]
  return rows.flatMap(([dx, spacing]) =>
    alongEdge({ ...land, x0: land.x1, x1: land.x1 + 40 }, 'x0', spacing, dx).map((p) =>
      palm(r, { x: p.x + range(r, -2, 2), z: p.z + range(r, -3, 3) }, 9, 14),
    ),
  )
}

function lightsFor(rect: Rect, land: Rect, skip: Edge | null): Spot[] {
  return EDGES.filter((e) => e !== skip && rect[e] !== land[e]).flatMap((e) => {
    const len = e[0] === 'x' ? rect.z1 - rect.z0 : rect.x1 - rect.x0
    if (len < 20) return []
    return alongEdge(rect, e, 34, 0.8).map((p) => ({ ...p, s: 1, r: OUTWARD[e] }))
  })
}

/** Palms, bushes, and streetlights for the whole plan, all on sidewalks, parks, or sand. */
export function greenery({ blocks, walks, land }: Plan, r: Rand) {
  const canalEdge = (b: Block): Edge | null =>
    b.canalSide === 'east' ? 'x1' : b.canalSide === 'west' ? 'x0' : null
  const sand = { ...land, x0: land.x1 + 10, x1: land.x1 + 18 }
  return {
    palms: [
      ...blocks.flatMap((b) => blockPalms(b, r)),
      ...beachPalms(land, r),
      ...walks
        .filter((w) => w.x0 === land.x0)
        .flatMap((w) => alongEdge(w, 'x0', 22, 3).map((p) => palm(r, p))),
    ],
    bushes: [
      ...blocks.filter((b) => b.park).flatMap((b) => scatter(r, inset(b.lot, 2), 24, 0.8, 1.6)),
      ...blocks.flatMap((b) => b.gardens.flatMap((g) => scatter(r, inset(g, 1.5), 3, 0.8, 1.6))),
      ...scatter(r, sand, Math.round((land.z1 - land.z0) / 9), 0.8, 1.8),
    ],
    lights: [
      ...blocks.flatMap((b) => lightsFor(b.rect, land, canalEdge(b))),
      ...walks.flatMap((w) => lightsFor(w, land, null)),
    ],
  }
}
