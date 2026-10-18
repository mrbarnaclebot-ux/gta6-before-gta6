import type { District, Rect } from './layout'
import { BAY, type Parcels, type Profile } from './lots'
import { bounds, contains, rectInside, rectRing, type Ring } from './polygon'
import { range, type Rand } from './rng'

/*
 * A lot's cells: its bounds split into rows and columns at jittered spacing, with some
 * neighbours in a row merged into one wider cell. Each cell knows which of its sides face a
 * street: `i` is -1 on the west edge, 1 on the east, 2 for a lone column touching both,
 * 0 inside; `j` likewise north to south.
 */

export interface LotCell {
  rect: Rect
  i: number
  j: number
}

const bays = (m: number) => Math.floor(m / BAY) * BAY

/** n + 1 split positions from a to b, the inner ones nudged by up to a sixth of a cell. */
function splits(n: number, a: number, b: number, r: Rand): number[] {
  const step = (b - a) / n
  return Array.from({ length: n + 1 }, (_, k) =>
    k === 0 || k === n ? a + step * k : a + step * k + (r() - 0.5) * step * 0.33,
  )
}

const edge = (from: number, to: number, n: number) =>
  n === 1 || (from === 0 && to === n) ? 2 : from === 0 ? -1 : to === n ? 1 : 0

/** The cells over a lot's bounds; beachfront lots are one hotel deep. */
export function cells(lot: Ring, p: Profile, district: District, r: Rand): LotCell[] {
  const box = bounds(lot)
  const nx = district === 'beachfront' ? 1 : Math.max(1, Math.round((box.x1 - box.x0) / p.cell))
  const nz = Math.max(1, Math.round((box.z1 - box.z0) / p.cell))
  const xs = splits(nx, box.x0, box.x1, r)
  const zs = splits(nz, box.z0, box.z1, r)
  const out: LotCell[] = []
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx;) {
      const span = i + 1 < nx && r() < p.merge ? 2 : 1
      out.push({
        rect: { x0: xs[i], x1: xs[i + span], z0: zs[j], z1: zs[j + 1] },
        i: edge(i, i + span, nx),
        j: edge(j, j + 1, nz),
      })
      i += span
    }
  }
  return out
}

/** The footprint a cell's building may take: set back on its street sides, gapped from neighbours. */
export function site(c: LotCell, p: Profile, district: District, r: Rand): Rect {
  const front = () => range(r, p.front[0], p.front[1])
  const inner = p.gap / 2
  const faces = (v: number, side: -1 | 1) => v === 2 || v === side
  // Beachfront hotels keep their terrace on the sea side (east), and back onto the alley.
  const beach = district === 'beachfront'
  return {
    x0: c.rect.x0 + (beach ? 1 : faces(c.i, -1) ? front() : inner),
    x1: c.rect.x1 - (beach ? front() + 2 : faces(c.i, 1) ? front() : inner),
    z0: c.rect.z0 + (faces(c.j, -1) ? front() : inner),
    z1: c.rect.z1 - (faces(c.j, 1) ? front() : inner),
  }
}

/** Shrinks a rect a side at a time until it lies inside the lot; null once smaller than three bays. */
export function fit(rect: Rect, lot: Ring): Rect | null {
  const b = { ...rect }
  for (let i = 0; i < 30; i++) {
    const w = b.x1 - b.x0
    const d = b.z1 - b.z0
    if (w < BAY * 3 || d < BAY * 3) return null
    if (rectInside(b, lot)) return b
    // Corner k: 0 (x0, z0), 1 (x1, z0), 2 (x1, z1), 3 (x0, z1). Give up the cheaper side.
    const bad = rectRing(b).findIndex((p) => !contains(lot, p))
    const xSide = bad === 0 || bad === 3 ? 'x0' : 'x1'
    const zSide = bad === 0 || bad === 1 ? 'z0' : 'z1'
    if (bad < 0) Object.assign(b, { x0: b.x0 + 1, x1: b.x1 - 1, z0: b.z0 + 1, z1: b.z1 - 1 })
    else if (d < w) b[xSide] += xSide === 'x0' ? 1.5 : -1.5
    else b[zSide] += zSide === 'z0' ? 1.5 : -1.5
  }
  return null
}

/** Snaps a fitted rect to whole bays, keeping the side that faces the street. */
export function snap(b: Rect, c: { i: number; j: number }): Rect {
  const w = bays(b.x1 - b.x0)
  const d = bays(b.z1 - b.z0)
  const x0 = c.i === -1 ? b.x0 : c.i === 1 ? b.x1 - w : (b.x0 + b.x1 - w) / 2
  const z0 = c.j === -1 ? b.z0 : c.j === 1 ? b.z1 - d : (b.z0 + b.z1 - d) / 2
  return { x0, x1: x0 + w, z0, z1: z0 + d }
}

/**
 * A beachfront hotel: a slab one room-and-corridor deep along the sea side of its lot, so its
 * long face looks out over the coast road; the rest of the lot behind it is a pool deck.
 */
export function hotel(fitted: Rect, r: Rand, out: Parcels): Rect {
  const deep = range(r, 18, 26)
  if (fitted.x1 - fitted.x0 < deep + 12) return fitted
  const slab = { ...fitted, x0: fitted.x1 - deep }
  // A deep lot keeps a pool deck by the hotel and parks the guests' cars behind it, by the alley.
  const deck = Math.max(fitted.x0, slab.x0 - 2 - DECK)
  if (deck - fitted.x0 > 14) out.parking.push(rectRing({ ...fitted, x1: deck - 1 }))
  out.plazas.push(
    rectRing({ ...fitted, x0: deck - fitted.x0 > 14 ? deck : fitted.x0, x1: slab.x0 - 2 }),
  )
  return slab
}

/** The widest a hotel's pool deck gets. */
const DECK = 24
