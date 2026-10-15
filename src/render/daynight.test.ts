import { describe, expect, it } from 'vitest'
import { advance, lighting, sunDirection } from './daynight'

describe('day and night', () => {
  it('rises in the east, peaks at noon, and sets in the west', () => {
    expect(sunDirection(6)[0]).toBeCloseTo(1)
    expect(sunDirection(12)[1]).toBeGreaterThan(0.85)
    expect(sunDirection(18)[0]).toBeCloseTo(-1)
    expect(sunDirection(0)[1]).toBeLessThan(-0.85)
  })

  it('matches the HDRI sun at the 10:00 start: about 50 degrees up, east of south', () => {
    const [x, y] = sunDirection(10)
    expect(Math.asin(y) * (180 / Math.PI)).toBeGreaterThan(45)
    expect(x).toBeGreaterThan(0.3)
  })

  it('switches the lights on at dusk and the moon at night', () => {
    const noon = lighting(12)
    const midnight = lighting(0)
    expect(noon.night).toBe(0)
    expect(noon.day).toBe(1)
    expect(midnight.night).toBe(1)
    expect(midnight.day).toBe(0)
    expect(midnight.light[1]).toBeGreaterThan(0)
    expect(Math.max(...midnight.color)).toBeLessThan(Math.max(...noon.color))
    expect(lighting(18).dusk).toBeGreaterThan(0.5)
  })

  it('wraps past midnight', () => {
    expect(advance(23.99, 50)).toBeCloseTo(0.99)
  })
})
