import { SEA_LEVEL, type Rect } from '../city/layout'
import { seaward } from '../land/coast'
import { CELL, gridRect, index } from '../land/grid'
import { nearRiver } from '../land/river'
import { heightAt } from '../city/terrain'
import type { Land } from '../land/plan'
import { bakeSeaField, type SeaField } from './field'
import { planReefs, REEF_GAP, type ReefPlan } from './reef-plan'
import { sandyShore } from '../land/beach-props'

/** Reefs and the baked sea field: plain data the terrain and water shaders both need first. */
export interface SeaData {
  reefs: ReefPlan
  field: SeaField
}

/** Ground height with the surf rocks stamped in, so the field sees them as land the surf foams around. */
function withRocks(c: Land, rocks: ReefPlan['surfRocks']) {
  // Rocks by 16 m cell: each is under a meter across, so a point need only check its own cell.
  const cell = (x: number, z: number) => Math.floor(x / 16) * 4096 + Math.floor(z / 16)
  const near = new Map<number, ReefPlan['surfRocks']>()
  for (const r of rocks) {
    for (const [dx, dz] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      const key = cell(r.x + dx * r.s * 0.4, r.z + dz * r.s * 0.4)
      const list = near.get(key) ?? []
      if (!list.includes(r)) near.set(key, [...list, r])
    }
  }
  return (x: number, z: number) => {
    const h = heightAt(c, x, z)
    const hit = near.get(cell(x, z))?.find((r) => Math.hypot(r.x - x, r.z - z) < r.s * 0.4)
    return hit ? Math.max(h, hit.y + hit.s) : h
  }
}

// Waves in the walled canal and its channels are a ripple of the open sea's; the river's a little more.
const CANAL_CALM = 0.15
const RIVER_CALM = 0.3

/** How big the waves get at (x, z), as a share of the open sea's. Called for every field texel. */
function calmness(c: Land) {
  const walled = [c.canal, ...c.waterways.channels.quays, ...c.waterways.channels.dredged]
  const within = (r: Rect, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1
  const g = c.ground
  // The river's water within 50 m of its line, marked once on the terrain grid.
  const river = new Uint8Array(g.h.length)
  nearRiver(g, c.waterways.river, 50, (k) => (river[k] = 1))
  return (x: number, z: number) => {
    if (walled.some((r) => within(r, x, z))) return CANAL_CALM
    const i = Math.round((x - g.x0) / CELL)
    const j = Math.round((z - g.z0) / CELL)
    if (i < 0 || j < 0 || i > g.nx || j > g.nz || !river[index(g, i, j)]) return 1
    // Upriver of the beach the river is sheltered; past the mouth it is open sea.
    return seaward(c.frame.coast, x, z) > 0 ? 1 : RIVER_CALM
  }
}

export function planSeaData(c: Land): SeaData {
  const grid = gridRect(c.ground)
  const floor = (x: number, z: number) => heightAt(c, x, z)
  const reefs = planReefs(
    {
      depth: (x, z) => SEA_LEVEL - floor(x, z),
      floor,
      shore: sandyShore(c, REEF_GAP),
    },
    SEA_LEVEL,
  )
  const field = bakeSeaField(withRocks(c, reefs.surfRocks), SEA_LEVEL, grid, calmness(c))
  return { reefs, field }
}
