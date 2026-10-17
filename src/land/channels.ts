import type { CityLayout, Rect } from '../city/layout'
import { seaward, type CoastField } from './coast'

/*
 * The canal's way out: past the city's edge it runs on between quay walls to the shore at
 * both ends, then between two rubble breakwaters into deep water. A branch leaves the south
 * channel westward along the city's edge and turns south to the sea under the highway.
 */

/** Breakwater width and how far past the shore it runs. */
const MOLE = { w: 7, out: 70 }
/** The branch: its middle line along the city's south edge, and where it turns to the sea. */
export const BRANCH = { z: 556, x: -260, half: 12 }

export interface Channels {
  /** Walled water at the canal's floor, outside the city. */
  quays: Rect[]
  /** Rubble breakwaters off each mouth; their rocks stand on the seabed. */
  moles: Rect[]
  /** Seabed dredged to the canal's floor between each pair of breakwaters. */
  dredged: Rect[]
  /** Where each channel meets the open sea (the breakwaters' ends), for tests and the perf probe. */
  mouths: { x: number; z: number }[]
}

/** First z from `z` stepping by `dir` where the shore line is crossed at x. */
function shoreZ(coast: CoastField, x: number, z: number, dir: 1 | -1): number {
  while (seaward(coast, x, z) < 0) z += dir
  return z
}

/** Quay, breakwaters, and dredged approach for a channel `x0..x1` reaching the shore going `dir`. */
function mouth(
  coast: CoastField,
  x0: number,
  x1: number,
  from: number,
  dir: 1 | -1,
  out: Channels,
) {
  const shore = shoreZ(coast, (x0 + x1) / 2, from, dir)
  const end = shore + dir * MOLE.out
  const span = (a: number, b: number) => ({ z0: Math.min(a, b), z1: Math.max(a, b) })
  out.quays.push({ x0, x1, ...span(from, shore) })
  out.moles.push(
    { x0: x0 - MOLE.w, x1: x0, ...span(shore - dir * 6, end) },
    { x0: x1, x1: x1 + MOLE.w, ...span(shore - dir * 6, end) },
  )
  out.dredged.push({ x0, x1, ...span(shore, end + dir * 30) })
  out.mouths.push({ x: (x0 + x1) / 2, z: end })
}

export function planChannels(c: CityLayout, coast: CoastField): Channels {
  const out: Channels = { quays: [], moles: [], dredged: [], mouths: [] }
  const { canal, land } = c
  mouth(coast, canal.x0, canal.x1, land.z0, -1, out)
  mouth(coast, canal.x0, canal.x1, land.z1, 1, out)
  const b = BRANCH
  out.quays.push({ x0: b.x - b.half, x1: canal.x0, z0: b.z - b.half, z1: b.z + b.half })
  mouth(coast, b.x - b.half, b.x + b.half, b.z + b.half, 1, out)
  return out
}
