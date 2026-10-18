import { noise2, smoothstep } from './noise'
import type { P2 } from './polyline'

/*
 * The districts outside the city, for the maps and the ground cover. The forest covers the
 * island's west and the hill's northern flanks down to the cliffs.
 */

export type Area = 'central' | 'residential' | 'hillside' | 'forest' | 'highway'

/** Map labels: a name and where it reads best. */
export const AREA_LABELS: { name: string; at: P2 }[] = [
  { name: 'Residential', at: { x: -1000, z: 470 } },
  { name: 'Hillside', at: { x: -1000, z: -420 } },
  { name: 'Forest', at: { x: -1560, z: -560 } },
  { name: 'Forest', at: { x: -1250, z: -860 } },
  { name: 'Lake', at: { x: -1420, z: -128 } },
  { name: 'West Beach', at: { x: -1560, z: 160 } },
]

/** 0 to 1: how much (x, z) lies in the forest: the island's west, and the hill's northern flanks. */
export function forestAt(x: number, z: number): number {
  const wobble = 45 * noise2(x / 150, z / 150, 21)
  const west = smoothstep(-1380, -1480, x + wobble)
  const north = smoothstep(-660, -740, z + wobble) * smoothstep(-760, -860, x)
  return Math.max(west, north)
}
