import { CURB_H, type CityLayout, type Rect } from './layout'
import { area, bounds, rectInside, type Ring } from './polygon'

/*
 * The beachfront hotels' lap pools, sunk into their pool decks. The water stands below the
 * coping and over the hidden floor under the city's slabs (UNDER_CITY), so it is waist deep:
 * the player wades rather than swims.
 */

/** Water surface: below the deck, and just above the street surface hidden beneath it (y = 0). */
export const POOL_WATER = CURB_H - 0.12
const EDGE = 2.5

/** A rect sunk in a plaza: the pool, if the plaza holds one. */
function poolIn(plaza: Ring): Rect | null {
  if (area(plaza) < 120) return null
  const b = bounds(plaza)
  const r = { x0: b.x0 + EDGE, x1: b.x1 - EDGE, z0: b.z0 + EDGE, z1: b.z1 - EDGE }
  // Room either side for a row of umbrellas (world/lots.ts).
  if (r.x1 - r.x0 < 11 || r.z1 - r.z0 < 6) return null
  // A long, narrow lap pool along the deck rather than one filling it.
  const w = Math.min(r.x1 - r.x0 - 7, 9)
  const pool = {
    ...r,
    x0: (r.x0 + r.x1 - w) / 2,
    x1: (r.x0 + r.x1 + w) / 2,
    z1: Math.min(r.z1, r.z0 + 22),
  }
  return rectInside(pool, plaza) ? pool : null
}

/** Every hotel pool, on the beachfront's pool decks. */
export const poolsOf = (c: Pick<CityLayout, 'blocks'>): Rect[] =>
  c.blocks
    .filter((b) => b.district === 'beachfront')
    .flatMap((b) => b.plazas.map(poolIn))
    .filter((p): p is Rect => p !== null)

/** The pools' water surface at (x, z), or null outside them. */
export const poolWaterAt = (pools: Rect[], x: number, z: number): number | null =>
  pools.some((p) => x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) ? POOL_WATER : null
