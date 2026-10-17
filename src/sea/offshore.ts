import { seaNormal, seaward, type CoastField } from '../land/coast'
import { smoothstep } from '../land/noise'

/*
 * The soft edge of the world: past about 320 m off the coast a current sets in toward the
 * island, gentle at first, until no boat or swimmer can make headway against it. There is
 * no wall to see or hit, just open sea that keeps carrying you back.
 */

/** Meters off the coast where the current starts, and where it is at full strength. */
export const OFFSHORE = { from: 320, full: 460 }

/** Toward the island at (x, z), into `out`; returns the current's strength, 0 to 1. */
export type Current = (x: number, z: number, out: { x: number; z: number }) => number

export function offshoreCurrent(coast: CoastField): Current {
  return (x, z, out) => {
    const d = seaward(coast, x, z)
    const k = smoothstep(OFFSHORE.from, OFFSHORE.full, d)
    if (k === 0) return 0
    // Straight back toward the nearest shore.
    const n = seaNormal(coast, x, z, 8)
    out.x = -n.x
    out.z = -n.z
    return k
  }
}
