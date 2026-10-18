import { rest, type Rest } from '../land/footing'
import type { Land } from '../land/plan'
import type { House } from '../land/residential'
import { at, offset, stations } from '../land/polyline'
import { heightAt, surfaceAt, waterSurfaceAt } from './terrain'
import { roadRise } from './canal-bridge'
import { segLength } from './faces'
import { CROSSWALK, endOf } from './junctions'
import { slice } from './network'
import { lotBays } from './parking-lots'
import { rng } from './rng'
import { STREET } from './streets'

/** A parked car: chassis origin on the ground, yaw 0 facing +z, its tilt, and a paint variant index. */
export interface ParkingSpot extends Rest {
  x: number
  z: number
  yaw: number
  variant: number
}

/** Half a car's wheelbase-ish length and track width: where it meets the ground. */
export const CAR_HALF = { l: 1.9, w: 0.85 }

/** A parallel parking space is this long; spaces keep this far past the stop bar. */
export const BAY_LENGTH = 6.5
const CLEAR = 4
const LOT_CARS = 8

type Spot = { x: number; z: number; yaw: number }

/** The parking lane's bays along one side of a street segment, in travel order, none across a driveway. */
export function curbBays(c: Land, seg: number, side: 1 | -1): Spot[] {
  const s = c.net.segments[seg]
  const len = segLength(s)
  const s0 = endOf(c.junctions, c.net, seg, true).mouth + CROSSWALK.bar + CLEAR
  const s1 = len - endOf(c.junctions, c.net, seg, false).mouth - CROSSWALK.bar - CLEAR
  if (s1 - s0 < BAY_LENGTH) return []
  // Right-hand traffic: the side-1 lane runs a to b with the curb on its right (offset is positive to the right).
  const line = offset(side > 0 ? s.pts : [...s.pts].reverse(), STREET.parking)
  const from = side > 0 ? s0 : len - s1
  const lane = slice(line, from, from + (s1 - s0))
  const n = Math.floor((s1 - s0) / BAY_LENGTH)
  const st = stations(lane)
  const clear = (p: Spot) =>
    c.driveways.every((d) => Math.hypot(p.x - d.x, p.z - d.z) > d.w / 2 + BAY_LENGTH / 2)
  return Array.from({ length: n }, (_, k) => {
    const u = ((k + 0.5) * (s1 - s0)) / n
    const i = Math.min(lane.length - 2, Math.max(0, st.findIndex((v) => v >= u) - 1))
    const yaw = Math.atan2(lane[i + 1].x - lane[i].x, lane[i + 1].z - lane[i].z)
    return { ...at(lane, u), yaw }
  }).filter(clear)
}

/** Every curbside bay on the city's streets, dry and off the canal's humps. */
function curbSpots(c: Land): Spot[] {
  return c.net.segments.flatMap((s, seg) =>
    s.kind !== 'street'
      ? []
      : [1, -1].flatMap((side) =>
          curbBays(c, seg, side as 1 | -1).filter(
            (p) =>
              waterSurfaceAt(c, p.x, p.z) === null &&
              roadRise(c, p.x, p.z) === 0 &&
              surfaceAt(c, p.x, p.z) === 0,
          ),
        ),
  )
}

/**
 * Seeded parked cars. The first is the bay nearest the spawn, so a new player sees a car
 * soon; the rest are scattered across the curbs, and a few stand in the parking lots.
 */
export function parkingSpots(c: Land, count: number, variants: number): ParkingSpot[] {
  const r = rng(c.seed + 101)
  const all = curbSpots(c)
  const d = (s: Spot) => Math.hypot(s.x - c.spawn.x, s.z - c.spawn.z)
  const nearest = all.reduce((a, b) => (d(b) < d(a) ? b : a))
  const others = all.filter((s) => s !== nearest)
  const picked = [nearest]
  while (picked.length < count && others.length)
    picked.push(others.splice(Math.floor(r() * others.length), 1)[0])
  // A few cars in the parking lots, one or two to a lot.
  const lots = c.blocks.flatMap((b) => b.parking).map(lotBays)
  for (let n = 0; n < LOT_CARS && lots.length;) {
    const bays = lots.splice(Math.floor(r() * lots.length), 1)[0]
    for (let k = 1 + Math.floor(r() * 2); k > 0 && bays.length && n < LOT_CARS; k--, n++) {
      picked.push(bays.splice(Math.floor(r() * bays.length), 1)[0])
    }
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
