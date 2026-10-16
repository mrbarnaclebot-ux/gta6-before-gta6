import { SEA_LEVEL } from '../city/layout'
import { heightAt } from '../city/terrain'
import { gridRect } from '../land/grid'
import type { Land } from '../land/plan'
import { bakeSeaField, type SeaField } from './field'
import { planReefs, type ReefPlan } from './reef-plan'

/** Reefs and the baked sea field: plain data the terrain and water shaders both need first. */
export interface SeaData {
  reefs: ReefPlan
  field: SeaField
}

/** Ground height with the surf rocks stamped in, so the field sees them as land the surf foams around. */
function withRocks(c: Land, rocks: ReefPlan['surfRocks']) {
  return (x: number, z: number) => {
    const h = heightAt(c, x, z)
    const hit = rocks.find((r) => Math.hypot(r.x - x, r.z - z) < r.s * 0.4)
    return hit ? Math.max(h, hit.y + hit.s) : h
  }
}

export function planSeaData(c: Land): SeaData {
  const grid = gridRect(c.ground)
  const floor = (x: number, z: number) => heightAt(c, x, z)
  const reefs = planReefs(
    {
      depth: (x, z) => SEA_LEVEL - floor(x, z),
      floor,
      x0: c.land.x1,
      z0: grid.z0,
      z1: grid.z1,
    },
    SEA_LEVEL,
  )
  // Water exists only from the canal east: the land west of it never dips below sea level.
  const rect = { ...grid, x0: c.canal.x0 - 40 }
  const field = bakeSeaField(withRocks(c, reefs.surfRocks), SEA_LEVEL, rect, c.canal)
  return { reefs, field }
}
