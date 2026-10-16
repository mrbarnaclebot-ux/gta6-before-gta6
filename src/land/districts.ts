import { noise2, smoothstep } from './noise'
import type { P2 } from './polyline'

/*
 * The districts outside the city, for the maps and the ground cover. The Forest is
 * only reserved here: its trees are planted in Phase 10b.
 */

export type Area = 'central' | 'residential' | 'hillside' | 'forest' | 'highway'

/** Map labels: a name and where it reads best. */
export const AREA_LABELS: { name: string; at: P2 }[] = [
  { name: 'Residential', at: { x: -1000, z: 470 } },
  { name: 'Hillside', at: { x: -1000, z: -420 } },
  { name: 'Forest', at: { x: -1560, z: -40 } },
  { name: 'Forest', at: { x: -900, z: -1000 } },
]

/** 0 to 1: how much (x, z) lies in the forest, which wraps the west and north edges beyond the hills. */
export function forestAt(x: number, z: number): number {
  const wobble = 45 * noise2(x / 150, z / 150, 21)
  const west = smoothstep(-1230, -1330, x + wobble)
  const north = smoothstep(-890, -960, z + wobble) * smoothstep(150, -50, x)
  return Math.max(west, north)
}
