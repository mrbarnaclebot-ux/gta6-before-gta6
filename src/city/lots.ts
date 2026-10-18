import type { District } from './layout'
import { area, clipRect, insetRing, rectRing, type Ring } from './polygon'
import type { Rand } from './rng'
import { massing, type Cell } from './massing'
import { cells, fit, hotel, site, snap } from './cells'

/*
 * What stands on a block's lot. The lot's bounds are split into a grid of cells sized per
 * district; each cell gets a building set back from the street (fitted inside the lot where
 * a diagonal or the curving coast road cuts it), a garden, a paved plaza, or a parking lot.
 * Remnants too small to build on become plazas. massing.ts then shapes the skyline.
 */

export type Style = 'glass' | 'residential' | 'deco'

export interface Building {
  /** Footprint center and size in meters; widths are whole window bays. */
  x: number
  z: number
  w: number
  d: number
  /** Floors counted from the ground: the roof is at floors x floor height. */
  floors: number
  /** Floors below this part that a podium fills (a tower standing on one); 0 on the ground. */
  base: number
  style: Style
  /** Palette index; the renderer maps it to a color per style. */
  tint: number
  /** Per-building variation (setback tower, crown, fin) without re-running the generator. */
  seed: number
  /** Balconies along the east and west faces: a beachfront hotel's sea view. */
  seaward?: boolean
  /** A podium with a tower (the next building) standing on it: its roof is a terrace. */
  podium?: boolean
}

export interface Parcels {
  buildings: Building[]
  /** Small lawns with palms. */
  gardens: Ring[]
  /** Paved squares with planters. */
  plazas: Ring[]
  /** Surface parking lots with painted bays. */
  parking: Ring[]
}

export const BAY = 3
export const FLOOR_H: Record<Style, number> = { glass: 3.8, residential: 3.2, deco: 3.4 }

export const buildingHeight = (b: Building) => b.floors * FLOOR_H[b.style]

/** [chance, style, min floors, max floors]; chances in a row sum to 1. */
export type Mix = [number, Style, number, number][]

export interface Profile {
  /** Target cell size, meters. */
  cell: number
  /** Setback from the street, and the gap between neighbours. */
  front: [number, number]
  gap: number
  /** Chances a cell is a garden, a plaza, or a parking lot. */
  garden: number
  plaza: number
  parking: number
  /** Chance an inner cell (no street front) is a courtyard. */
  courtyard: number
  /** Chance two cells side by side make one building. */
  merge: number
  /** Chance a tall building stands on a podium. */
  podium: number
  mix: Mix
}

export const PROFILE: Record<District, Profile> = {
  // Central: dense and tall, glass towers on podiums, the tallest on the corners.
  downtown: {
    cell: 38,
    front: [2, 6],
    gap: 3,
    garden: 0.03,
    plaza: 0.08,
    parking: 0,
    courtyard: 0.5,
    merge: 0.3,
    podium: 0.65,
    mix: [
      [0.6, 'glass', 18, 66],
      [0.4, 'residential', 14, 42],
    ],
  },
  midtown: {
    cell: 30,
    front: [1.5, 4],
    gap: 2,
    garden: 0.08,
    plaza: 0.04,
    parking: 0.08,
    courtyard: 0.55,
    merge: 0.25,
    podium: 0.35,
    mix: [
      [0.55, 'residential', 5, 18],
      [0.25, 'glass', 8, 26],
      [0.2, 'deco', 3, 6],
    ],
  },
  // Low and pastel: a street wall of two to five floors.
  deco: {
    cell: 22,
    front: [0.4, 1.6],
    gap: 1.2,
    garden: 0.06,
    plaza: 0.02,
    parking: 0.08,
    courtyard: 0.7,
    merge: 0.15,
    podium: 0,
    mix: [
      [0.85, 'deco', 2, 5],
      [0.15, 'residential', 4, 8],
    ],
  },
  // Hotels facing the sea across the coast road, behind terraces.
  beachfront: {
    cell: 44,
    front: [5, 8],
    gap: 3,
    garden: 0.04,
    plaza: 0,
    parking: 0,
    courtyard: 0,
    merge: 0,
    podium: 0.25,
    mix: [
      [0.55, 'deco', 3, 7],
      [0.45, 'residential', 10, 26],
    ],
  },
}

/** Splits a block's lot into buildings, gardens, plazas, and parking. */
export function buildingsFor(block: { lot: Ring; district: District }, r: Rand): Parcels {
  const p = PROFILE[block.district]
  const out: Parcels = { buildings: [], gardens: [], plazas: [], parking: [] }
  const built: Cell[] = []
  for (const c of cells(block.lot, p, block.district, r)) {
    const region = clipRect(block.lot, c.rect)
    const share = area(region) / ((c.rect.x1 - c.rect.x0) * (c.rect.z1 - c.rect.z0))
    const fitted = share > 0.35 ? fit(site(c, p, block.district, r), block.lot) : null
    const use = fitted ? pickUse(c, p, r) : 'plaza'
    if (use === 'garden' && area(region) > 60) out.gardens.push(insetRing(region, 0.5))
    else if (use === 'plaza' && area(region) > 60) out.plazas.push(insetRing(region, 0.5))
    else if (use === 'parking') out.parking.push(rectRing(fitted!))
    else if (use === 'building') {
      const slab = block.district === 'beachfront' ? hotel(fitted!, r, out) : fitted!
      const rect = snap(slab, block.district === 'beachfront' ? { ...c, i: 1 } : c)
      built.push({
        rect,
        corner: c.i !== 0 && c.j !== 0,
        i: Math.sign(c.i % 2),
        j: Math.sign(c.j % 2),
      })
    }
  }
  out.buildings = massing(built, block.district, p, r)
  return out
}

/** What a cell becomes. Inner cells, with no street front, are mostly courtyards. */
function pickUse(c: { i: number; j: number }, p: Profile, r: Rand) {
  const roll = r()
  const inner = c.i === 0 && c.j === 0
  if (inner && roll < p.courtyard) return roll < p.courtyard * 0.4 ? 'garden' : 'plaza'
  if (roll < p.garden) return 'garden'
  if (roll < p.garden + p.plaza) return 'plaza'
  if (!inner && roll < p.garden + p.plaza + p.parking) return 'parking'
  return 'building'
}
