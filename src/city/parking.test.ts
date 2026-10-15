import { describe, expect, it } from 'vitest'
import { generateLand } from '../land/plan'
import { ROAD_HALF } from './layout'
import { parkingSpots } from './parking'
import { surfaceAt, waterSurfaceAt } from './terrain'

const city = generateLand(7, 1000)
const spots = parkingSpots(city, 14, 4)

describe('parkingSpots', () => {
  it('is deterministic, starts near the spawn, and spreads out', () => {
    expect(parkingSpots(city, 14, 4)).toEqual(spots)
    expect(spots).toHaveLength(14)
    const first = spots[0]
    expect(Math.hypot(first.x - city.spawn.x, first.z - city.spawn.z)).toBeLessThan(25)
    const xs = spots.map((s) => s.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(300)
  })

  it('parks on dry road, off the centerline, with the curb on the right', () => {
    for (const s of spots) {
      expect(surfaceAt(city, s.x, s.z)).toBe(0)
      expect(waterSurfaceAt(city, s.x, s.z)).toBeNull()
      const road = city.roads.find((r) => Math.abs((r.axis === 'z' ? s.x : s.z) - r.at) < ROAD_HALF)
      expect(road).toBeDefined()
      // Right vector of a car facing (sin yaw, cos yaw) is (-cos yaw, sin yaw).
      const right = road!.axis === 'z' ? -Math.cos(s.yaw) : Math.sin(s.yaw)
      const offset = (road!.axis === 'z' ? s.x : s.z) - road!.at
      expect(Math.sign(offset)).toBe(Math.sign(right))
      expect(s.variant).toBeGreaterThanOrEqual(0)
      expect(s.variant).toBeLessThan(4)
    }
  })
})
