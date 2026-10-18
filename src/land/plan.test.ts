import { describe, expect, it } from 'vitest'
import { SEA_LEVEL } from '../city/layout'
import { heightAt, waterSurfaceAt } from '../city/terrain'
import { CELL } from './grid'
import { generateLand, UNDER_CITY } from './plan'
import { DECK_FROM } from './path'
import { offset } from './polyline'
import { HILLS } from './shape'
import { LAKE } from './lake'

const land = generateLand(7, 1000)
const g = land.ground

describe('terrain', () => {
  // The island's grid takes over 5 s to generate on CI's 2-core runner.
  it('is the same every load', () => {
    expect(generateLand(7, 1000).ground.h).toEqual(g.h)
  }, 30_000)

  it('lies flat under the city and meets its edge just below the sidewalk', () => {
    const { land: c, canal } = land
    expect(heightAt(land, 0, 0)).toBeCloseTo(UNDER_CITY)
    expect(heightAt(land, -400, -400)).toBeCloseTo(UNDER_CITY)
    expect(heightAt(land, (canal.x0 + canal.x1) / 2, 0)).toBeLessThan(SEA_LEVEL - 2)
    for (let z = c.z0 + 40; z < c.z1; z += 97) {
      const edge = heightAt(land, c.x0, z)
      expect(edge).toBeGreaterThanOrEqual(-0.05)
      expect(edge).toBeLessThan(0.3)
    }
  })

  it('has no cliffs: neighbouring heights outside the city blend smoothly', () => {
    let steepest = 0
    const n = g.nz + 1
    for (let i = 0; i < g.nx; i++) {
      for (let j = 0; j < g.nz; j++) {
        const x = g.x0 + i * CELL
        const z = g.z0 + j * CELL
        const c = land.land
        if (x >= c.x0 - CELL && x <= c.x1 + CELL && z >= c.z0 - CELL && z <= c.z1 + CELL) continue
        const h = g.h[i * n + j]
        steepest = Math.max(
          steepest,
          Math.abs(g.h[(i + 1) * n + j] - h),
          Math.abs(g.h[i * n + j + 1] - h),
        )
      }
    }
    // About 57 degrees at the steepest: a hairpin's bank cut and the headlands' low cliffs.
    // Steep, never a wall.
    expect(steepest / CELL).toBeLessThan(1.6)
  })

  it('rises to hills of 60 to 100 m in the north-west', () => {
    const peak = heightAt(land, HILLS[0].x, HILLS[0].z)
    expect(peak).toBeGreaterThan(60)
    expect(peak).toBeLessThan(100)
    expect(land.lookout.y).toBeCloseTo(peak, 0)
  })

  it('has a dry beach that slopes under the sea, and water only in the sea, canal, river, and lake', () => {
    const { land: c, canal } = land
    expect(heightAt(land, c.x1 + 20, 0)).toBeGreaterThan(SEA_LEVEL)
    expect(waterSurfaceAt(land, c.x1 + 120, 0)).toBe(SEA_LEVEL)
    expect(waterSurfaceAt(land, (canal.x0 + canal.x1) / 2, 0)).toBe(SEA_LEVEL)
    expect(waterSurfaceAt(land, c.x1 + 20, 0)).toBeNull()
    expect(waterSurfaceAt(land, 0, 0)).toBeNull()
    for (const [x, z] of [
      [-1000, 400],
      [-1150, -560],
      [-300, -590],
      [-1550, 600],
    ]) {
      expect(waterSurfaceAt(land, x, z)).toBeNull()
    }
    const river = land.waterways.river.pts
    expect(waterSurfaceAt(land, river[10].x, river[10].z)).toBe(SEA_LEVEL)
    expect(waterSurfaceAt(land, LAKE.x, LAKE.z)).toBe(LAKE.level)
  })

  it('cuts every road outside the city into the ground it runs on, but where it bridges water', () => {
    for (const p of land.paths) {
      if (p.kind === 'highway' || p.kind === 'ramp') continue
      // A deck spans wherever a road stands clear of the ground (scenery/bridges.ts).
      const ground = p.pts.filter((q) => q.y - heightAt(land, q.x, q.z) <= DECK_FROM)
      const worst = Math.max(...ground.map((q) => Math.abs(heightAt(land, q.x, q.z) - q.y)))
      // The narrow trail climbs at up to 30%, between grid points 4 m apart.
      expect(worst, p.name).toBeLessThan(p.kind === 'trail' ? 0.8 : 0.4)
    }
  })

  it('keeps the ground under each street where it meets its turning circle', () => {
    for (const ring of land.paths.filter((p) => p.name.endsWith(' circle'))) {
      const street = land.paths.find((p) => `${p.name} circle` === ring.name)!
      const c = ring.pts.reduce((a, q) => ({ x: a.x + q.x, z: a.z + q.z }), { x: 0, z: 0 })
      const near = (q: { x: number; z: number }) =>
        Math.hypot(q.x - c.x / ring.pts.length, q.z - c.z / ring.pts.length) < 25
      for (const side of [-1, 0, 1]) {
        offset(street.pts, side * (street.width / 2 - 0.3)).forEach((q, i) => {
          // Asphalt lies 5 cm over its centerline (scenery/bridges.ts LIFT).
          if (near(q))
            expect(heightAt(land, q.x, q.z) - street.pts[i].y, ring.name).toBeLessThan(0.05)
        })
      }
    }
  })
})
