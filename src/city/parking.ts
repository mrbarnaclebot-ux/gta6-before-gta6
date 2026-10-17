import { rest, type Rest } from '../land/footing'
import type { Land } from '../land/plan'
import type { House } from '../land/residential'
import { heightAt, surfaceAt, waterSurfaceAt } from './terrain'
import { ROAD_HALF, type Road } from './layout'
import { humpSpan, roadRise } from './canal-bridge'
import { rng } from './rng'

/** A parked car: chassis origin on the ground, yaw 0 facing +z, its tilt, and a paint variant index. */
export interface ParkingSpot extends Rest {
  x: number
  z: number
  yaw: number
  variant: number
}

/** Half a car's wheelbase-ish length and track width: where it meets the ground. */
export const CAR_HALF = { l: 1.9, w: 0.85 }

// Center of the curb lane: half a car width plus a hand's breadth off the curb.
const CURB_LANE = ROAD_HALF - 1.3
// Keep clear of crosswalks and turning traffic at intersections.
const SPOT_OFFSETS = [-22, 18]

/** Every curbside spot on one road: two per side per block, skipping bridges over water. */
type Curb = { x: number; z: number; yaw: number }

/** On or near a humped canal bridge, with a car's length to spare. */
const onHump = (c: Land, s: Curb) => {
  const span = humpSpan(c.canal)
  return (
    roadRise(c, s.x, s.z) > 0 || (s.x > span.x0 - 3 && s.x < span.x1 + 3 && Math.abs(s.yaw) > 1)
  )
}

function spotsAlong(c: Land, road: Road): Curb[] {
  const crossings = (road.axis === 'z' ? c.zRoads : c.xRoads).filter(
    (v) => v > road.from && v < road.to,
  )
  const out: Curb[] = []
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
        if (waterSurfaceAt(c, spot.x, spot.z) === null && !onHump(c, spot)) out.push(spot)
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
  const others = all.filter((s) => s !== nearest)
  const picked = [nearest]
  while (picked.length < count && others.length) {
    picked.push(others.splice(Math.floor(r() * others.length), 1)[0])
  }
  const surface = (x: number, z: number) => surfaceAt(c, x, z)
  return picked.map((s) => ({
    ...s,
    ...rest(surface, s.x, s.z, s.yaw, CAR_HALF.l, CAR_HALF.w),
    variant: Math.floor(r() * variants),
  }))
}

/** The middle of a house's driveway, facing the street. */
function onDrive(h: House) {
  const gx = h.garage * (h.w / 2 - 2.2)
  const lz = h.d / 2 + 4
  const cos = Math.cos(h.yaw)
  const sin = Math.sin(h.yaw)
  return { x: h.x + gx * cos + lz * sin, z: h.z - gx * sin + lz * cos, yaw: h.yaw }
}

/** Cars on the driveways of `count` houses, sloping with the drive. */
export function drivewaySpots(c: Land, count: number, variants: number): ParkingSpot[] {
  const r = rng(c.seed + 202)
  const pool = [...c.houses]
  const surface = (x: number, z: number) => heightAt(c, x, z)
  const out: ParkingSpot[] = []
  while (out.length < count && pool.length) {
    const s = onDrive(pool.splice(Math.floor(r() * pool.length), 1)[0])
    const at = rest(surface, s.x, s.z, s.yaw, CAR_HALF.l, CAR_HALF.w)
    out.push({ ...s, ...at, variant: Math.floor(r() * variants) })
  }
  return out
}
