import type { District, Rect } from './layout'
import { range, type Rand } from './rng'

export type Style = 'glass' | 'residential' | 'deco'

export interface Building {
  /** Footprint center and size in meters; widths are whole window bays. */
  x: number
  z: number
  w: number
  d: number
  floors: number
  style: Style
  /** Palette index; the renderer maps it to a color per style. */
  tint: number
  /** Per-building variation (setback tower, crown, fin) without re-running the generator. */
  seed: number
}

export const BAY = 3
export const FLOOR_H: Record<Style, number> = { glass: 3.8, residential: 3.2, deco: 3.4 }

export const buildingHeight = (b: Building) => b.floors * FLOOR_H[b.style]

/** [chance, style, min floors, max floors]; chances in a row sum to 1. */
type Mix = [number, Style, number, number][]

const PROFILE: Record<District, { lot: number; empty: number; setback: number; mix: Mix }> = {
  // Central: dense and tall, mostly glass towers.
  downtown: {
    lot: 30,
    empty: 0.04,
    setback: 3,
    mix: [
      [0.78, 'glass', 22, 72],
      [0.22, 'residential', 16, 44],
    ],
  },
  midtown: {
    lot: 28,
    empty: 0.14,
    setback: 3,
    mix: [
      [0.6, 'residential', 5, 16],
      [0.2, 'glass', 8, 22],
      [0.2, 'deco', 3, 6],
    ],
  },
  deco: {
    lot: 21,
    empty: 0.12,
    setback: 2.5,
    mix: [
      [0.8, 'deco', 2, 5],
      [0.2, 'residential', 6, 14],
    ],
  },
  beachfront: {
    lot: 24,
    empty: 0.05,
    setback: 2,
    mix: [
      [0.65, 'deco', 3, 6],
      [0.35, 'residential', 10, 24],
    ],
  },
}

function choose(mix: Mix, r: Rand): { style: Style; floors: number } {
  let x = r()
  for (const [chance, style, lo, hi] of mix) {
    x -= chance
    // Squared roll: most buildings are short, a few are much taller, like a real skyline.
    if (x <= 0) return { style, floors: Math.round(lo + (hi - lo) * r() ** 2) }
  }
  const [, style, lo] = mix[mix.length - 1]
  return { style, floors: lo }
}

const bays = (meters: number) => Math.floor(meters / BAY) * BAY

/** Splits a lot into a grid of cells: most get one building, the rest become small gardens. */
export function buildingsFor(lot: Rect, district: District, r: Rand) {
  const p = PROFILE[district]
  const lw = lot.x1 - lot.x0
  const ld = lot.z1 - lot.z0
  const nx = Math.max(1, Math.round(lw / p.lot))
  const nz = Math.max(1, Math.round(ld / p.lot))
  const cw = lw / nx
  const cd = ld / nz
  const buildings: Building[] = []
  const gardens: Rect[] = []
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const cell = {
        x0: lot.x0 + cw * i,
        x1: lot.x0 + cw * (i + 1),
        z0: lot.z0 + cd * j,
        z1: lot.z0 + cd * (j + 1),
      }
      const w = bays(cw - 2 * range(r, 0.5, p.setback))
      const d = bays(cd - 2 * range(r, 0.5, p.setback))
      if (r() < p.empty || w < BAY * 3 || d < BAY * 3) {
        gardens.push(cell)
        continue
      }
      buildings.push({
        x: lot.x0 + cw * (i + 0.5) + range(r, -0.5, 0.5) * (cw - w),
        z: lot.z0 + cd * (j + 0.5) + range(r, -0.5, 0.5) * (cd - d),
        w,
        d,
        ...choose(p.mix, r),
        tint: Math.floor(r() * 64),
        seed: Math.floor(r() * 2 ** 31),
      })
    }
  }
  return { buildings, gardens }
}
