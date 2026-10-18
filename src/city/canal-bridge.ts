import { ROAD_HALF, type CityLayout, type Rect } from './layout'

/*
 * Where the city's streets cross the canal they hump over it on short bridges, high enough
 * for a speedboat to pass under: level over the water, easing down to the street on either
 * bank well short of the junctions. Pure numbers, shared by the meshes, the colliders, the
 * traffic lanes, and anything else that stands on a street.
 */

/** Deck surface height over the water, how far past each bank it stays level, and the ramp length. */
export const HUMP = { top: 1.65, over: 2, ramp: 22 }
/** Deck thickness under the road over the water. */
export const DECK = 0.5

type Canal = Pick<CityLayout, 'canal' | 'zRoads'>

/** The stretch of x the humps cover, ramps included. */
export const humpSpan = (canal: Rect) => ({
  x0: canal.x0 - HUMP.over - HUMP.ramp,
  x1: canal.x1 + HUMP.over + HUMP.ramp,
})

/** Height of a hump's road surface at x (0 off it). */
export function humpRise(canal: Rect, x: number): number {
  const a = canal.x0 - HUMP.over
  const b = canal.x1 + HUMP.over
  const d = x < a ? a - x : x > b ? x - b : 0
  if (d >= HUMP.ramp) return 0
  return HUMP.top * (0.5 + 0.5 * Math.cos((Math.PI * d) / HUMP.ramp))
}

/** The street's surface height at (x, z): up on a hump where an x-road crosses the canal, else 0. */
export function roadRise(c: Canal, x: number, z: number): number {
  const span = humpSpan(c.canal)
  if (x <= span.x0 || x >= span.x1) return 0
  return c.zRoads.some((at) => Math.abs(z - at) < ROAD_HALF) ? humpRise(c.canal, x) : 0
}
