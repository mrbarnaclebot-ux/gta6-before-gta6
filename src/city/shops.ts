import type { Block } from './layout'
import { BAY, FLOOR_H, type Building } from './lots'
import { rng } from './rng'
import { crossing } from './polygon'

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
  /** The awning over it (an index into world/awnings.ts' styles), if it has one. */
  awning?: number
}

/** Awning styles; a building's shops share one, and two in three shops have it. */
export const AWNING_STYLES = 3

/** Meters from p along (nx, nz) to the lot line, and the kind of street beyond it there. */
function toLotLine(block: Block, p: { x: number; z: number }, nx: number, nz: number) {
  const far = { x: p.x + nx * 100, z: p.z + nz * 100 }
  let best = { d: Infinity, kind: block.lotSides[0] }
  block.lot.forEach((a, i) => {
    const x = crossing(p, far, a, block.lot[(i + 1) % block.lot.length])
    if (x && x.t >= 0 && x.u >= 0 && x.u <= 1 && x.t * 100 < best.d)
      best = { d: x.t * 100, kind: block.lotSides[i] }
  })
  return best
}

/** The four walls: outward normal, the wall's center offset, and its length. */
const walls = (b: Building) => [
  { nx: 1, nz: 0, off: b.w / 2, len: b.d },
  { nx: -1, nz: 0, off: b.w / 2, len: b.d },
  { nx: 0, nz: 1, off: b.d / 2, len: b.w },
  { nx: 0, nz: -1, off: b.d / 2, len: b.w },
]

/** True if a shop at p, facing (nx, nz), looks onto a street within a few meters. */
function onStreet(block: Block, p: { x: number; z: number }, nx: number, nz: number): boolean {
  const line = toLotLine(block, p, nx, nz)
  return (line.kind === 'street' || line.kind === 'avenue') && line.d <= STREET_GAP
}

/** Shops along the street-facing walls of this block's low-rise buildings. */
export function shopsFor(block: Block): Shop[] {
  if (!HAS_SHOPS.has(block.district)) return []
  const out: Shop[] = []
  for (const b of block.buildings) {
    if (b.style === 'glass' || b.base > 0) continue
    const r = rng(b.seed ^ 0x5f3759df)
    for (const w of walls(b)) {
      const n = Math.floor(w.len / SHOP_W)
      // Stepping by 3 through 8 kinds: neighbors never match, and no pair repeats on a wall.
      const first = Math.floor(r() * SHOP_KINDS)
      for (let i = 0; i < n; i++) {
        const kind = (first + i * 3) % SHOP_KINDS
        if (r() < EMPTY) continue
        const along = (i - (n - 1) / 2) * SHOP_W
        const at = {
          x: b.x + w.nx * w.off + Math.abs(w.nz) * along,
          z: b.z + w.nz * w.off + Math.abs(w.nx) * along,
        }
        // Each slot checks its own frontage: where a diagonal cuts the lot it varies along the wall.
        if (!onStreet(block, at, w.nx, w.nz)) continue
        // Only under an upper floor, so the awning hangs from a wall and not the roof edge.
        const covered = b.floors > 1 && (i + b.seed) % 3 !== 0
        out.push({
          ...at,
          nx: w.nx,
          nz: w.nz,
          width: SHOP_W,
          height: FLOOR_H[b.style],
          kind,
          ...(covered ? { awning: b.seed % AWNING_STYLES } : {}),
        })
      }
    }
  }
  return out
}
