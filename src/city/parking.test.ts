import { describe, expect, it } from 'vitest'
import { generateLand } from '../land/plan'
import { CURB_H } from './layout'
import { parkingSpots } from './parking'
import { surfaceAt, waterSurfaceAt } from './terrain'
import { closest } from '../land/polyline'
import { STREET } from './streets'

const city = generateLand(7, 1000)
const spots = parkingSpots(city, 14, 4)

describe('parkingSpots', () => {
  it('is deterministic, starts near the spawn, and spreads out', () => {
    expect(parkingSpots(city, 14, 4)).toEqual(spots)
    expect(spots.length).toBeGreaterThan(14)
    const first = spots[0]
    expect(Math.hypot(first.x - city.spawn.x, first.z - city.spawn.z)).toBeLessThan(60)
    const xs = spots.map((s) => s.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(300)
  })

  it('parks on dry road in the parking lane, curb on the right, or in a lot', () => {
    const streets = city.net.segments.filter((s) => s.kind === 'street')
    for (const s of spots) {
      expect(waterSurfaceAt(city, s.x, s.z)).toBeNull()
      expect(s.variant).toBeGreaterThanOrEqual(0)
      expect(s.variant).toBeLessThan(4)
      if (surfaceAt(city, s.x, s.z) === CURB_H) continue
      expect(surfaceAt(city, s.x, s.z)).toBe(0)
      const near = streets
        .map((st) => ({ st, c: closest(st.pts, s) }))
        .sort((a, b) => a.c.d - b.c.d)[0]
      expect(near.c.d).toBeCloseTo(STREET.parking, 1)
      // Facing (sin yaw, cos yaw), the driver's right is (-cos yaw, sin yaw); the curb lies that way.
      const right = { x: -Math.cos(s.yaw), z: Math.sin(s.yaw) }
      expect((s.x - near.c.at.x) * right.x + (s.z - near.c.at.z) * right.z).toBeGreaterThan(0)
    }
    expect(spots.some((s) => surfaceAt(city, s.x, s.z) === CURB_H)).toBe(true)
  })
})
