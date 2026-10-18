import type { District, Rect } from './layout'
import { BAY, type Building, type Mix, type Profile, type Style } from './lots'
import { range, type Rand } from './rng'

/*
 * The skyline of one block: how tall each building is, in what style and color. The tallest
 * picks go to the corners (corner towers); same-style neighbours never share a color or come
 * within a floor of each other; tall glass and residential buildings often stand as a slim
 * tower on a podium that fills the lot.
 */

/** A fitted footprint and where its cell sits in the block: -1 west/north edge, 1 east/south, 0 inside. */
export interface Cell {
  rect: Rect
  corner: boolean
  i: number
  j: number
}

/** Wall palette sizes per style in world/buildings.ts: same-style neighbours must differ in color. */
const PALETTE: Record<Style, number> = { deco: 8, residential: 5, glass: 5 }
/** Footprints closer than this are neighbours. */
const NEAR = 6

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

const gap = (a: Building, b: Building) =>
  Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2)

/** Same-style buildings within NEAR of b. */
const lookalikes = (b: Building, others: Building[]) =>
  others.filter((o) => o.style === b.style && gap(b, o) <= NEAR)

/**
 * Moves a building off every same-style neighbour's color and height at once: the nearest
 * free color, then the nearest height at least two floors from each of them.
 */
function vary(b: Building, others: Building[], r: Rand): void {
  const near = lookalikes(b, others)
  const n = PALETTE[b.style]
  const used = new Set(near.map((o) => o.tint % n))
  for (let k = 0; k < 64 && used.has(b.tint % n); k++) b.tint = (b.tint + 1) % 64
  const clash = (f: number) => near.some((o) => Math.abs(o.floors - f) < 2)
  const dir = r() < 0.5 ? 1 : -1
  for (let d = 0; d < 64 && clash(b.floors); d++) {
    const f = [b.floors + dir * d, b.floors - dir * d].find((x) => x >= 2 && !clash(x))
    if (f !== undefined) b.floors = f
  }
}

/** Splits a tall building into a podium over the whole footprint and a tower pushed toward the corner. */
function podium(b: Building, c: Cell, r: Rand): Building[] {
  const base = b.style === 'glass' ? 3 + Math.floor(r() * 4) : 2 + Math.floor(r() * 3)
  const w = Math.max(15, Math.floor((b.w * range(r, 0.55, 0.75)) / BAY) * BAY)
  const d = Math.max(15, Math.floor((b.d * range(r, 0.55, 0.75)) / BAY) * BAY)
  const tower: Building = {
    ...b,
    x: b.x + (c.i * (b.w - w)) / 2,
    z: b.z + (c.j * (b.d - d)) / 2,
    w,
    d,
    base,
    seed: b.seed + 1,
  }
  return [{ ...b, floors: base, podium: true }, tower]
}

/** Buildings for a block's fitted cells. */
export function massing(cells: Cell[], district: District, p: Profile, r: Rand): Building[] {
  const picks = cells.map(() => choose(p.mix, r))
  // Corner towers: outside the low deco district, the tallest picks stand on the corners.
  if (district !== 'deco') {
    const order = cells
      .map((c, k) => ({ k, key: +c.corner + r() * 0.5 }))
      .sort((a, b) => b.key - a.key)
    const tall = [...picks].sort((a, b) => b.floors - a.floors)
    order.forEach((o, n) => (picks[o.k] = tall[n]))
  }
  const out: Building[] = []
  cells.forEach((c, k) => {
    const { rect } = c
    const b: Building = {
      x: (rect.x0 + rect.x1) / 2,
      z: (rect.z0 + rect.z1) / 2,
      w: rect.x1 - rect.x0,
      d: rect.z1 - rect.z0,
      ...picks[k],
      base: 0,
      tint: Math.floor(r() * 64),
      seed: Math.floor(r() * 2 ** 30) * 2,
    }
    if (district === 'beachfront' && b.style === 'residential') b.seaward = true
    const tall = b.style !== 'deco' && b.floors >= 16 && b.w >= 24 && b.d >= 24
    const [ground, tower] = tall && r() < p.podium ? podium(b, c, r) : [b]
    // The street sees the podium, so that is what must differ from the neighbours.
    vary(ground, out, r)
    if (tower) Object.assign(tower, { tint: ground.tint, base: ground.floors })
    out.push(ground, ...(tower ? [tower] : []))
  })
  return out
}
