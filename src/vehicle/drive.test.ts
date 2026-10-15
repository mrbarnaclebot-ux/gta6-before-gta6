import { describe, expect, it } from 'vitest'
import {
  BRAKE,
  chaseFov,
  drag,
  ENGINE_FORCE,
  floods,
  maxSteer,
  pedals,
  REVERSE_TOP,
  steerToward,
} from './drive'

describe('driving rules', () => {
  it('W drives, S brakes while rolling forward and then reverses', () => {
    expect(pedals(1, 0)).toEqual({ engine: ENGINE_FORCE, brake: 0 })
    expect(pedals(-1, 10)).toEqual({ engine: 0, brake: BRAKE })
    expect(pedals(-1, 0).engine).toBeLessThan(0)
    expect(pedals(1, -5)).toEqual({ engine: 0, brake: BRAKE })
  })

  it('caps reverse speed and does nothing when stalled', () => {
    expect(pedals(-1, -REVERSE_TOP - 1).engine).toBe(0)
    expect(pedals(1, 0, true).engine).toBe(0)
  })

  it('narrows the steering lock with speed and eases toward it', () => {
    expect(maxSteer(0)).toBeCloseTo(0.6)
    expect(maxSteer(30)).toBeLessThan(maxSteer(10))
    expect(maxSteer(-30)).toBe(maxSteer(30))
    const one = steerToward(0, 1, 0, 1 / 60)
    expect(one).toBeGreaterThan(0)
    expect(one).toBeLessThan(maxSteer(0))
    let a = 0
    for (let i = 0; i < 120; i++) a = steerToward(a, -1, 0, 1 / 60)
    expect(a).toBeCloseTo(-maxSteer(0))
  })

  it('widens the view with speed, opposes motion with drag, and floods for good', () => {
    expect(chaseFov(0)).toBe(55)
    expect(chaseFov(100)).toBe(chaseFov(45))
    expect(chaseFov(-20)).toBe(chaseFov(20))
    expect(drag(10)).toBeLessThan(0)
    expect(drag(-10)).toBeGreaterThan(0)
    expect(Math.abs(drag(55)) / 1200).toBeCloseTo((2 * ENGINE_FORCE) / 1200, 0)
    expect(floods(false, 0.2)).toBe(false)
    expect(floods(false, 1)).toBe(true)
    expect(floods(true, 0)).toBe(true)
  })
})
