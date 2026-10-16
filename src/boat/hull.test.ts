import { describe, expect, it } from 'vitest'
import { bank, buoyancy, hullDrag, HULL_POINTS, lift, MASS, planing, thrust, trim } from './hull'

const G = 9.81

/** Top speed: step a point mass under thrust and drag on calm water until it settles. */
function topSpeed(): number {
  let v = 0
  for (let t = 0; t < 120; t += 0.05) v += ((thrust(1, v, false) + hullDrag(v)) / MASS) * 0.05
  return v
}

describe('boat hull', () => {
  it('floats with its waterline at y = 0: six points at rest depth carry its weight', () => {
    const atRest = HULL_POINTS.reduce((s, p) => s + buoyancy(-p[1], 0), 0)
    expect(atRest).toBeCloseTo(MASS * G, 0)
    // Out of the water a point lifts nothing; rising damps, sinking pushes back harder.
    expect(buoyancy(-0.1, 0)).toBe(0)
    expect(buoyancy(0.45, 1)).toBeLessThan(buoyancy(0.45, 0))
    expect(buoyancy(0.45, -1)).toBeGreaterThan(buoyancy(0.45, 0))
    // Fully under, deeper water adds no more lift.
    expect(buoyancy(3, 0)).toBe(buoyancy(5, 0))
  })

  it('plows at low speed, planes past about 12 m/s, and tops out near 20 m/s', () => {
    expect(planing(2)).toBe(0)
    expect(planing(12)).toBe(1)
    expect(planing(8)).toBeGreaterThan(0)
    // Drag per (m/s)^2 is far lower once on the plane: the hull rides on its bow wave.
    expect(-hullDrag(14) / 14 ** 2).toBeLessThan((-hullDrag(3) / 3 ** 2) * 0.3)
    const top = topSpeed()
    expect(top).toBeGreaterThan(17)
    expect(top).toBeLessThan(23)
    expect(lift(15)).toBeCloseTo(MASS * G * 0.3, 0)
  })

  it('rears its bow over the hump, then levels to a shallow running trim', () => {
    expect(trim(0)).toBeLessThan(0.01)
    const hump = trim(7)
    expect(hump).toBeGreaterThan(0.07)
    expect(trim(18)).toBeLessThan(hump * 0.6)
    expect(trim(18)).toBeGreaterThan(0.02)
  })

  it('pushes in both directions, not when dead, and leans into turns only at speed', () => {
    expect(thrust(1, 0, false)).toBeGreaterThan(0)
    expect(thrust(-1, 0, false)).toBeLessThan(0)
    expect(thrust(1, 0, true)).toBe(0)
    expect(thrust(1, 26, false)).toBe(0)
    expect(bank(1, 1)).toBeCloseTo(0)
    // Steering left (+1) at speed rolls the left side down: a negative roll about +z.
    expect(bank(1, 15)).toBeLessThan(-0.1)
    expect(bank(-1, 15)).toBeGreaterThan(0.1)
  })
})
