import type { Block } from './layout'
import { BAY, FLOOR_H, type Building } from './lots'
import { rng } from './rng'

/*
 * Ground-floor shops: two bays wide and one floor high, on every wall of a low-rise building
 * that stands within a few meters of its block's sidewalk. Pure data for world/shopfronts.ts.
 */

/** Shop pictures in the sign atlas (layers 0 to 7). */
export const SHOP_KINDS = 8
export const SHOP_W = 2 * BAY
/** A wall farther than this from the lot edge is set back behind a yard: no shops. */
const STREET_GAP = 4
// Some slots stay plain wall, so a street is not one unbroken mall.
const EMPTY = 0.2
const HAS_SHOPS = new Set<Block['district']>(['deco', 'beachfront', 'midtown'])

export interface Shop {
  /** Center of the shop's face at the foot of the wall. */
  x: number
  z: number
  /** Outward normal of the wall, along x or z. */
  nx: number
  nz: number
  width: number
  height: number
  /** Atlas layer. */
  kind: number
}

/** The four walls: outward normal, the wall's center offset, its length, its gap to the street. */
function walls(b: Building, lot: Block['lot']) {
  return [
    { nx: 1, nz: 0, off: b.w / 2, len: b.d, gap: lot.x1 - (b.x + b.w / 2) },
    { nx: -1, nz: 0, off: b.w / 2, len: b.d, gap: b.x - b.w / 2 - lot.x0 },
    { nx: 0, nz: 1, off: b.d / 2, len: b.w, gap: lot.z1 - (b.z + b.d / 2) },
    { nx: 0, nz: -1, off: b.d / 2, len: b.w, gap: b.z - b.d / 2 - lot.z0 },
  ]
}

/** Shops along the street-facing walls of this block's low-rise buildings. */
export function shopsFor(block: Block): Shop[] {
  if (!HAS_SHOPS.has(block.district)) return []
  const out: Shop[] = []
  for (const b of block.buildings) {
    if (b.style === 'glass') continue
    const r = rng(b.seed ^ 0x5f3759df)
    for (const w of walls(b, block.lot)) {
      if (w.gap > STREET_GAP) continue
      const n = Math.floor(w.len / SHOP_W)
      // Stepping by 3 through 8 kinds: neighbors never match, and no pair repeats on a wall.
      const first = Math.floor(r() * SHOP_KINDS)
      for (let i = 0; i < n; i++) {
        const kind = (first + i * 3) % SHOP_KINDS
        if (r() < EMPTY) continue
        const along = (i - (n - 1) / 2) * SHOP_W
        out.push({
          x: b.x + w.nx * w.off + Math.abs(w.nz) * along,
          z: b.z + w.nz * w.off + Math.abs(w.nx) * along,
          nx: w.nx,
          nz: w.nz,
          width: SHOP_W,
          height: FLOOR_H[b.style],
          kind,
        })
      }
    }
  }
  return out
}
