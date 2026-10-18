import type { P2 } from '../land/polyline'
import type { Rect } from './layout'
import { area, type Ring } from './polygon'
import { SECTION } from './streets'

/*
 * The beach promenade between the coast road and the sand widens where the road bows
 * inland. There it holds a park strip: lawns with palms, cut by footpaths down to the beach
 * every so often, with a paved walk along the road and another along the sand.
 */

/** Paved walk kept along the sand, and the narrowest lawn worth planting. */
const SAND_WALK = 5
const MIN_LAWN = 6
/** Lawn pieces between the footpaths, and the paths' width. */
const PIECE = 52
const PATH = 4

/** Lawn rings along the promenade, from the coast road's centerline. */
export function promenadeLawns(coast: P2[], land: Rect): Ring[] {
  const west = (p: P2) => p.x + SECTION.avenue.half + SECTION.avenue.walk
  const east = land.x1 - SAND_WALK
  const wide = coast.filter((p) => east - west(p) >= MIN_LAWN)
  if (wide.length < 2) return []
  const z0 = wide[0].z
  const z1 = wide[wide.length - 1].z
  const out: Ring[] = []
  const n = Math.max(1, Math.round((z1 - z0) / PIECE))
  for (let k = 0; k < n; k++) {
    const a = z0 + ((z1 - z0) * k) / n + (k ? PATH / 2 : 0)
    const b = z0 + ((z1 - z0) * (k + 1)) / n - (k < n - 1 ? PATH / 2 : 0)
    const side = wide.filter((p) => p.z >= a && p.z <= b).map((p) => ({ x: west(p), z: p.z }))
    if (side.length < 2) continue
    const ring = [...side, { x: east, z: side[side.length - 1].z }, { x: east, z: side[0].z }]
    out.push(area(ring) > 0 ? ring : ring.reverse())
  }
  return out
}
