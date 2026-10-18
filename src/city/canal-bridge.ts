import type { Rect } from './layout'
import type { Network } from './network'
import { SECTION } from './streets'

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

/** A street crossing the canal east to west: its z and half width. */
export interface Bridge {
  z: number
  half: number
}

/** Every street that crosses the canal, from the network's junctions on the canal's line. */
export function canalBridges(net: Network, canal: Rect): Bridge[] {
  const out: Bridge[] = []
  for (const j of net.junctions) {
    if (j.x < canal.x0 || j.x > canal.x1) continue
    const roads = j.segs.map((s) => net.segments[s]).filter((s) => SECTION[s.kind].speed > 0)
    if (roads.length)
      out.push({ z: j.z, half: Math.max(...roads.map((s) => SECTION[s.kind].half)) })
  }
  return out.sort((a, b) => a.z - b.z)
}

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

/** The bridge whose deck covers (x, z), if any. */
export function bridgeAt(c: { canal: Rect; bridges: Bridge[] }, x: number, z: number) {
  const span = humpSpan(c.canal)
  if (x <= span.x0 || x >= span.x1) return null
  return c.bridges.find((b) => Math.abs(z - b.z) < b.half) ?? null
}

/** The street's surface height at (x, z): up on a hump where a street crosses the canal, else 0. */
export function roadRise(c: { canal: Rect; bridges: Bridge[] }, x: number, z: number): number {
  return bridgeAt(c, x, z) ? humpRise(c.canal, x) : 0
}
