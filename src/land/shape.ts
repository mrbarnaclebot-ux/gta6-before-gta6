import type { Rect } from '../city/layout'
import { sandAt, seaward, type CoastField } from './coast'
import { LAKE, lakeHollow } from './lake'
import { fbm, noise2, ridged, smoothstep } from './noise'

/*
 * The natural lie of the land before any road or building is cut into it: rolling ground
 * west of the city and the hills to the north-west, falling to the sea on every side. Where
 * the shore is sandy it eases down to a beach with dunes and a berm; where it is rocky the
 * ground runs on to the edge and drops to the seabed, in low cliffs under the hills.
 */

const SEED = 7

export interface Hill {
  x: number
  z: number
  /** Radius where the hill has fallen to about a third of its peak. */
  r: number
  peak: number
}

/** The Hillside district's hill, the west headland's hill, and a low one on the south-west headland. */
export const HILLS: Hill[] = [
  { x: -1150, z: -560, r: 300, peak: 84 },
  { x: -1520, z: -330, r: 230, peak: 52 },
  { x: -1620, z: 600, r: 220, peak: 34 },
]

type Profile = [distance: number, height: number][]

// Wide and gentle like Miami Beach: dry sand rising to a berm crest at 45 m that the high
// tides built, a beach face falling about 1 in 7 to the waterline at 60 m, a low terrace the
// surf breaks on, then the shelf.
const BEACH: Profile = [
  [0, 0.1],
  [36, 0.25],
  [45, 0.62],
  [48, 0.56],
  [60, -1.2],
  [78, -1.8],
  [130, -3.6],
  [250, -8],
  [400, -12],
]
/** Meters off the coast where the shelf drops away, where it reaches open-sea depth, and how much deeper. */
export const OPEN_SEA = { from: 300, to: 500, depth: 18 }

/** Meters seaward of the coast line where the high tide leaves its line of wrack. */
export const TIDE_LINE = 57.5

export function sample(p: Profile, d: number): number {
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
  /** The whole terrain grid. */
  grid: Rect
  coast: CoastField
}

/** The beach without its dunes, `d` meters seaward of the coast line. */
export const plainBeach = (d: number) => sample(BEACH, d)

/**
 * Dunes on the back of the beach: a foredune and a lower one behind it, crests wandering
 * in and out, broken by blowouts (saddles the wind has cut, their sand heaped up behind).
 * `wild` is 0 by the city, where they stay low, to 1 on the far beaches.
 */
export function duneHeight(d: number, x: number, z: number, wild: number): number {
  if (d < 2 || d > 38) return 0
  const crest = 15 + 6 * noise2(x / 95, z / 95, SEED + 11)
  const ridge =
    Math.exp(-(((d - crest) / 7.5) ** 2)) + 0.6 * Math.exp(-(((d - crest + 11) / 5.5) ** 2))
  const fade = smoothstep(2, 7, d) * (1 - smoothstep(30, 38, d))
  const along = 0.62 + 0.38 * fbm(x / 36, z / 36, SEED + 5, 3)
  const blow = smoothstep(0.18, 0.42, noise2(x / 62, z / 62, SEED + 13))
  const lobe = 0.7 * blow * Math.exp(-(((d - crest + 12) / 6) ** 2))
  // Hummocks: the wind piles sand round each clump of grass.
  const hummock = 0.8 + 0.4 * fbm(x / 11, z / 11, SEED + 19, 2)
  return (1.3 + 4.9 * wild) * (ridge * along * hummock * (1 - 0.85 * blow) + lobe) * fade
}

/**
 * Older dunes inland of the beach on the wild shores, grassed over: a hummocky field up to
 * about 4 m high, `-d` meters behind the coast line, fading out into the fields.
 */
export function backDunes(d: number, x: number, z: number, wild: number): number {
  if (d > 0 || d < -60 || wild <= 0) return 0
  const field = Math.max(0, 0.15 + fbm(x / 28, z / 28, SEED + 31, 3))
  const band = smoothstep(-60, -38, d) * (1 - smoothstep(-12, 0, d))
  return 4.6 * wild * field ** 1.3 * band
}

/** Whether dune grass grows at (x, z), `d` meters seaward: on the dune crests of sandy shores, in patches. */
export function duneGrassAt(f: Frame, x: number, z: number, d: number): boolean {
  if (d < 4 || d > 36 || sandAt(f.coast, x, z) < 0.7) return false
  return duneHeight(d, x, z, wildness(f, x, z)) >= 0.3 && fbm(x / 18, z / 18, 61, 2) >= -0.1
}

/** Sandy shore `d` meters seaward of the coast line. */
export const beachHeight = (d: number, x: number, z: number, wild: number) =>
  plainBeach(d) + duneHeight(d, x, z, wild)

/** A rocky shore: the ground keeps its height `top` to the edge, then drops in a cliff to the seabed. */
function rockyShore(d: number, top: number, x: number, z: number): number {
  const drop = top + 2.6
  // The face leans between about 38 and 53 degrees along the shore: bare rock where it is
  // steep, grassed slopes between, so the cliff is never one even bank. Half linear, half
  // eased, so most of its height is near the steepest, and never past it (the terrain folds).
  const steep = smoothstep(-0.6, 0.05, fbm(x / 45, z / 45, SEED + 23, 2))
  const w = Math.max(5, (1.25 * drop) / (0.78 + 0.55 * steep))
  const t = Math.min(1, d / w)
  const lumps = 0.8 * fbm(x / 14, z / 14, SEED + 17, 2)
  const bed = -2.6 - 9.4 * smoothstep(w, w + 300, d) + lumps * smoothstep(w, w + 20, d)
  return d < w ? top - drop * (0.5 * t + 0.5 * smoothstep(0, 1, t)) : bed
}

const hill = (h: Hill, x: number, z: number) => {
  const r2 = ((x - h.x) ** 2 + (z - h.z) ** 2) / (h.r * h.r)
  if (r2 > 9) return 0
  return h.peak * Math.exp(-r2) * (0.82 + 0.36 * ridged(x / 260, z / 260, SEED + 9, 4))
}

export function rectGap(r: Rect, x: number, z: number): number {
  return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1))
}

/** 0 by the city to 1 well away from it: how untamed the shore is. */
export const wildness = (f: Frame, x: number, z: number) =>
  smoothstep(120, 520, rectGap(f.city, x, z))

/** Inland ground: rolling fields and hills, eased flat toward the city. */
function inland(f: Frame, x: number, z: number): number {
  const rolling =
    2.4 + 2.6 * fbm(x / 320, z / 320, SEED, 4) + 0.5 * fbm(x / 70, z / 70, SEED + 2, 3)
  const hills = HILLS.reduce((s, h) => s + hill(h, x, z), 0)
  const k = smoothstep(0, 240, rectGap(f.city, x, z))
  return Math.max(0.25, 0.1 + (rolling + hills - 0.1) * k)
}

/** Knolls along the cliff tops of the wild rocky shores, so the cliff line rises and falls. */
function knoll(f: Frame, d: number, sand: number, x: number, z: number): number {
  if (d < -40 || sand >= 1) return 0
  const lift = 5 * Math.max(0, fbm(x / 55, z / 55, SEED + 29, 2))
  return lift * (1 - sand) * wildness(f, x, z) * smoothstep(-40, 0, Math.min(d, 0))
}

/** Natural ground height at (x, z), before roads, building pads, and waterways are cut in. */
export function natural(f: Frame, x: number, z: number): number {
  const d = seaward(f.coast, x, z)
  const sand = sandAt(f.coast, x, z)
  const top = inland(f, x, z) + knoll(f, d, sand, x, z)
  if (d >= 0) {
    // Past the shelf the seabed falls away to open-sea depth: far water reads deep blue
    // and hides the end of the terrain grid.
    const deep = OPEN_SEA.depth * smoothstep(OPEN_SEA.from, OPEN_SEA.to, d)
    if (sand <= 0) return rockyShore(d, top, x, z) - deep
    const beach = beachHeight(d, x, z, wildness(f, x, z))
    return (sand >= 1 ? beach : beach + (rockyShore(d, top, x, z) - beach) * (1 - sand)) - deep
  }
  // A sandy shore eases down to the top of the beach over the last 140 m inland.
  const eased = 0.1 + (top - 0.1) * smoothstep(0, 140, -d)
  const dunes = backDunes(d, x, z, wildness(f, x, z))
  return lakeHollow(LAKE, x, z, top + (eased + dunes - top) * sand)
}
