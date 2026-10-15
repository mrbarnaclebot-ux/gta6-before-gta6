import { describe, expect, it } from 'vitest'
import {
  breathe,
  buoyancy,
  ENTER_DEPTH,
  EXIT_DEPTH,
  FLOAT_DEPTH,
  MAX_BREATH,
  MAX_HEALTH,
  nextMode,
  wadeFactor,
} from './swim'

/** Runs buoyancy with simple integration and returns the feet depth after `seconds`. */
function simulate(depth: number, seconds: number, dive = false, surface = false): number {
  let vy = 0
  const dt = 1 / 60
  for (let t = 0; t < seconds; t += dt) {
    vy = buoyancy(vy, depth, dive, surface, dt)
    depth -= vy * dt
  }
  return depth
}

describe('swimming', () => {
  it('switches modes with hysteresis', () => {
    expect(nextMode('walking', ENTER_DEPTH - 0.1)).toBe('walking')
    expect(nextMode('walking', ENTER_DEPTH + 0.1)).toBe('swimming')
    expect(nextMode('swimming', EXIT_DEPTH + 0.1)).toBe('swimming')
    expect(nextMode('swimming', EXIT_DEPTH - 0.1)).toBe('walking')
  })

  it('floats back to the surface from below and from above', () => {
    expect(simulate(5, 10)).toBeCloseTo(FLOAT_DEPTH, 1)
    expect(simulate(FLOAT_DEPTH - 0.4, 10)).toBeCloseTo(FLOAT_DEPTH, 1)
  })

  it('dives while held and surfaces faster with surface held', () => {
    expect(simulate(FLOAT_DEPTH, 2, true)).toBeGreaterThan(FLOAT_DEPTH + 2)
    expect(simulate(6, 1.5, false, true)).toBeLessThan(simulate(6, 1.5))
  })

  it('slows wading as the water deepens', () => {
    expect(wadeFactor(0)).toBe(1)
    expect(wadeFactor(1.2)).toBeCloseTo(0.55)
  })

  it('drains breath underwater, refills above, and drowns at zero', () => {
    const v = { health: MAX_HEALTH, breath: MAX_BREATH }
    breathe(v, true, 10)
    expect(v.breath).toBe(MAX_BREATH - 10)
    expect(v.health).toBe(MAX_HEALTH)
    breathe(v, true, MAX_BREATH)
    expect(v.breath).toBe(0)
    expect(v.health).toBeCloseTo(MAX_HEALTH - 100)
    v.health = 50
    breathe(v, true, 1)
    expect(v.health).toBeCloseTo(40)
    breathe(v, false, 1)
    expect(v.breath).toBeGreaterThan(0)
    expect(v.health).toBeCloseTo(40)
  })
})
