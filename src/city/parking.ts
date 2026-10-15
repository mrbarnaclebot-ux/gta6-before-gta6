import type { Land } from '../land/plan'
import { ROAD_HALF, type Road } from './layout'
import { rng } from './rng'
import { waterSurfaceAt } from './terrain'

/** A parked car: chassis origin on the road, yaw 0 facing +z, and a paint variant index. */
export interface ParkingSpot {
  x: number
  z: number
  yaw: number
  variant: number
}

// Center of the curb lane: half a car width plus a hand's breadth off the curb.
const CURB_LANE = ROAD_HALF - 1.3
// Keep clear of crosswalks and turning traffic at intersections.
const SPOT_OFFSETS = [-22, 18]

/** Every curbside spot on one road: two per side per block, skipping bridges over water. */
function spotsAlong(c: Land, road: Road): Omit<ParkingSpot, 'variant'>[] {
  const crossings = (road.axis === 'z' ? c.zRoads : c.xRoads).filter(
    (v) => v > road.from && v < road.to,
  )
  const out: Omit<ParkingSpot, 'variant'>[] = []
  for (let i = 0; i < crossings.length - 1; i++) {
    const mid = (crossings[i] + crossings[i + 1]) / 2
    for (const along of SPOT_OFFSETS) {
      for (const side of [1, -1]) {
        // Right-hand traffic: the curb is on the car's right.
        const lateral = road.at + side * CURB_LANE
        const spot =
          road.axis === 'z'
            ? { x: lateral, z: mid + along * side, yaw: side > 0 ? Math.PI : 0 }
            : { x: mid + along * side, z: lateral, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2 }
        if (waterSurfaceAt(c, spot.x, spot.z) === null) out.push(spot)
      }
    }
  }
  return out
}

/**
 * Seeded parked cars. The first is the spot nearest the spawn, so a new player
 * sees a car right away; the rest are scattered across the map.
 */
export function parkingSpots(c: Land, count: number, variants: number): ParkingSpot[] {
  const r = rng(c.seed + 101)
  const all = c.roads.flatMap((road) => spotsAlong(c, road))
  const d = (s: { x: number; z: number }) => Math.hypot(s.x - c.spawn.x, s.z - c.spawn.z)
  const nearest = all.reduce((a, b) => (d(b) < d(a) ? b : a))
  const rest = all.filter((s) => s !== nearest)
  const picked = [nearest]
  while (picked.length < count && rest.length) {
    picked.push(rest.splice(Math.floor(r() * rest.length), 1)[0])
  }
  return picked.map((s) => ({ ...s, variant: Math.floor(r() * variants) }))
}
