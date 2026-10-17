import { SEA_LEVEL, type Rect } from '../city/layout'
import { seaward } from '../land/coast'
import { closest } from '../land/polyline'
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
  const reach = Math.max(0, ...rocks.map((r) => r.s * 0.4))
  const xs = rocks.map((r) => r.x)
  const zs = rocks.map((r) => r.z)
  const box = {
    x0: Math.min(...xs) - reach,
    x1: Math.max(...xs) + reach,
    z0: Math.min(...zs) - reach,
    z1: Math.max(...zs) + reach,
  }
  return (x: number, z: number) => {
    const h = heightAt(c, x, z)
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) return h
    const hit = rocks.find((r) => Math.hypot(r.x - x, r.z - z) < r.s * 0.4)
    return hit ? Math.max(h, hit.y + hit.s) : h
  }
}

// Waves in the walled canal and its channels are a ripple of the open sea's; the river's a little more.
const CANAL_CALM = 0.15
const RIVER_CALM = 0.3

/** How big the waves get at (x, z), as a share of the open sea's. */
function calmness(c: Land) {
  const walled = [c.canal, ...c.waterways.channels.quays, ...c.waterways.channels.dredged]
  const within = (r: Rect, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1
  const river = c.waterways.river
  const box = river.pts.reduce(
    (b, p) => ({
      x0: Math.min(b.x0, p.x - 40),
      x1: Math.max(b.x1, p.x + 40),
      z0: Math.min(b.z0, p.z - 40),
      z1: Math.max(b.z1, p.z + 40),
    }),
    { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity },
  )
  return (x: number, z: number) => {
    if (walled.some((r) => within(r, x, z))) return CANAL_CALM
    // Upriver of the beach the river is sheltered; past the mouth it is open sea.
    if (!within(box, x, z) || seaward(c.frame.coast, x, z) > 0) return 1
    return closest(river.pts, { x, z }).d < 50 ? RIVER_CALM : 1
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
  const field = bakeSeaField(withRocks(c, reefs.surfRocks), SEA_LEVEL, grid, calmness(c))
  return { reefs, field }
}
