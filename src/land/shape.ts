import type { Rect } from '../city/layout'
import { fbm, noise2, ridged, smoothstep } from './noise'

/*
 * The natural lie of the land before any road or building is cut into it: rolling
 * ground west of the city, the hills to the north-west, a ridge around the map edge,
 * and the beach with its dunes sloping into the sea to the east.
 */

const SEED = 7

export interface Hill {
  x: number
  z: number
  /** Radius where the hill has fallen to about a third of its peak. */
  r: number
  peak: number
}

/** The Hillside district's hill, the forest hill west of it, and a low one in the south-west woods. */
export const HILLS: Hill[] = [
  { x: -1150, z: -560, r: 300, peak: 84 },
  { x: -1560, z: -200, r: 240, peak: 56 },
  { x: -1600, z: 560, r: 260, peak: 38 },
]

type Profile = [distance: number, height: number][]

// Wide and gentle like Miami Beach: dry sand to about 60 m, then shallows.
const BEACH: Profile = [
  [0, 0.05],
  [50, -0.7],
  [72, -1.6],
  [130, -3.6],
  [250, -8],
  [400, -12],
]

function sample(p: Profile, d: number): number {
  for (let i = 1; i < p.length; i++) {
    const [d1, h1] = p[i]
    if (d <= d1) {
      const [d0, h0] = p[i - 1]
      return h0 + ((h1 - h0) * (Math.max(d, d0) - d0)) / (d1 - d0)
    }
  }
  return p[p.length - 1][1]
}

export interface Frame {
  /** The paved city. */
  city: Rect
  /** The whole terrain grid; a ridge rises along its west, north, and south edges. */
  grid: Rect
}

/** Where the beach starts: the promenade edge beside the city, wandering a little east beyond it. */
export function coastX(f: Frame, z: number): number {
  const beyond = smoothstep(f.city.z1 + 20, f.city.z1 + 280, Math.abs(z))
  return f.city.x1 + beyond * (40 + 22 * noise2(z / 160, 3.3, SEED))
}

/** Dry beach, dunes, and seabed, `d` meters seaward of the coast line. */
export function beachHeight(d: number, z: number): number {
  const bump = smoothstep(3, 12, d) * (1 - smoothstep(28, 46, d))
  const dunes = 1.5 * bump * (0.55 + 0.45 * fbm(z / 55, d / 22, SEED + 5, 3))
  return sample(BEACH, d) + Math.max(0, dunes)
}

const hill = (h: Hill, x: number, z: number) => {
  const r2 = ((x - h.x) ** 2 + (z - h.z) ** 2) / (h.r * h.r)
  if (r2 > 9) return 0
  return h.peak * Math.exp(-r2) * (0.82 + 0.36 * ridged(x / 260, z / 260, SEED + 9, 4))
}

function rectGap(r: Rect, x: number, z: number): number {
  return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1))
}

/** Inland ground `inward` meters from the coast: rolling fields, hills, and the edge ridge, eased flat toward the city. */
function inland(f: Frame, x: number, z: number, inward: number): number {
  const rolling =
    2.4 + 2.6 * fbm(x / 320, z / 320, SEED, 4) + 0.5 * fbm(x / 70, z / 70, SEED + 2, 3)
  const hills = HILLS.reduce((s, h) => s + hill(h, x, z), 0)
  const edge = Math.min(x - f.grid.x0, z - f.grid.z0, f.grid.z1 - z)
  const m = 1 - smoothstep(0, 340, edge)
  // The ridge fades out toward the beach, so the coast ends in a headland, not a wall.
  const ridge =
    m * m * (105 + 45 * fbm(x / 240, z / 240, SEED + 4, 3)) * smoothstep(60, 520, inward)
  const h = rolling + hills + ridge
  const k = smoothstep(0, 240, rectGap(f.city, x, z))
  return Math.max(0.25, 0.1 + (h - 0.1) * k)
}

/** Natural ground height at (x, z), before roads and building pads are cut in. */
export function natural(f: Frame, x: number, z: number): number {
  const d = x - coastX(f, z)
  if (d >= 0) return beachHeight(d, z)
  // Easing down to the top of the beach over the last 140 m inland.
  const c = smoothstep(0, 140, -d)
  return 0.05 + (inland(f, x, z, -d) - 0.05) * c
}
