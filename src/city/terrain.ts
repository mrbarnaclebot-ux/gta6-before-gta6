import { sampleGrid } from '../land/grid'
import type { Land } from '../land/plan'
import { CURB_H, ROAD_HALF, SEA_LEVEL, type CityLayout, type Rect } from './layout'

export { CANAL_FLOOR, UNDER_CITY } from '../land/plan'

/** Ground height at (x, z) from the baked heightmap: the same surface the physics collides with. */
export function heightAt(c: Pick<Land, 'ground'>, x: number, z: number): number {
  return sampleGrid(c.ground, x, z)
}

/** Water surface height at (x, z), or null on land. Sea and canal share sea level. */
export function waterSurfaceAt(c: Pick<Land, 'ground'>, x: number, z: number) {
  return heightAt(c, x, z) < SEA_LEVEL ? SEA_LEVEL : null
}

/** Park lawns sit a step above the sidewalk. */
export const PARK_TOP = CURB_H + 0.07

const within = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

/** Walkable surface height at (x, z): terrain outside the city; road, park lawn, or sidewalk inside. */
export function surfaceAt(c: CityLayout & Pick<Land, 'ground'>, x: number, z: number): number {
  if (!within(c.land, x, z)) return heightAt(c, x, z)
  const lawn = (b: CityLayout['blocks'][number]) =>
    b.park ? within(b.lot, x, z) : b.gardens.some((g) => within(g, x, z))
  if (c.blocks.some(lawn)) return PARK_TOP
  const onRoad = c.roads.some((r) =>
    r.axis === 'x'
      ? Math.abs(z - r.at) < ROAD_HALF && x > r.from && x < r.to
      : Math.abs(x - r.at) < ROAD_HALF && z > r.from && z < r.to,
  )
  return onRoad ? 0 : CURB_H
}
