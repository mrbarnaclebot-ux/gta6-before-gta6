import { PARK_TOP, surfaceAt } from '../city/terrain'
import type { Rect } from '../city/layout'
import type { Land } from '../land/plan'
import { closest } from '../land/polyline'
import { seaward } from '../land/coast'

/** What the feet sound like. Trails and dirt pass as grass: there are three recordings. */
export type Ground = 'concrete' | 'sand' | 'grass'

export interface Footing {
  /** On the paved city island, on a lawn there, on a paved road outside it. */
  city: boolean
  lawn: boolean
  road: boolean
  /** Meters inland of the line where the beach starts (negative is on the beach). */
  inland: number
}

/** Pure: which footstep set a spot gets. */
export function groundOf(f: Footing): Ground {
  if (f.city) return f.lawn ? 'grass' : 'concrete'
  if (f.road) return 'concrete'
  // Matches the terrain splat: sand fades in over the last few meters before the coast line.
  return f.inland < 8 ? 'sand' : 'grass'
}

const within = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

/** Reads the land plan for groundOf. Cheap enough for a few footsteps a second. */
export function footingAt(land: Land, x: number, z: number, y: number): Footing {
  const city = within(land.land, x, z)
  const lawn = city && y >= PARK_TOP - 0.03 && surfaceAt(land, x, z) >= PARK_TOP - 1e-3
  const p = { x, z }
  const road =
    !city &&
    land.paths.some(
      (path) => path.kind !== 'trail' && closest(path.pts, p).d < path.width / 2 + 0.5,
    )
  return { city, lawn, road, inland: -seaward(land.frame.coast, x, z) }
}
