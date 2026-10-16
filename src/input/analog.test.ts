import { describe, expect, it } from 'vitest'
import { clampLength, shape, thumbstick, trigger } from './analog'

describe('shape', () => {
  it('drops input inside the deadzone', () => {
    expect(shape({ x: 0.1, y: -0.1 })).toEqual({ x: 0, y: 0 })
  })

  it('starts near zero past the deadzone and reaches 1 at the rim, keeping direction', () => {
    expect(Math.hypot(...Object.values(shape({ x: 0.2, y: 0 })))).toBeLessThan(0.01)
    const full = shape({ x: 0, y: -1 })
    expect(full.x).toBeCloseTo(0)
    expect(full.y).toBeCloseTo(-1)
    // A worn stick past the rim still clamps to 1.
    expect(Math.hypot(...Object.values(shape({ x: 0.9, y: 0.9 })))).toBeCloseTo(1)
  })

  it('is gentler than linear in the middle', () => {
    const half = shape({ x: 0.59, y: 0 }).x
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(0.5)
  })
})

describe('trigger', () => {
  it('ignores a resting trigger and maps a full pull to 1', () => {
    expect(trigger(0.03)).toBe(0)
    expect(trigger(1)).toBe(1)
  })
})

describe('thumbstick', () => {
  it('follows the finger inside the radius', () => {
    const s = thumbstick({ x: 100, y: 100 }, { x: 100, y: 72 }, 56)
    expect(s.knob).toEqual({ x: 0, y: -28 })
    expect(s.value.y).toBeCloseTo(-0.5)
  })

  it('pins the knob to the rim when the finger runs past it', () => {
    const s = thumbstick({ x: 0, y: 0 }, { x: 300, y: 400 }, 50)
    expect(Math.hypot(s.knob.x, s.knob.y)).toBeCloseTo(50)
    expect(s.value.x).toBeCloseTo(0.6)
    expect(s.value.y).toBeCloseTo(0.8)
  })
})

describe('clampLength', () => {
  it('never lets a key plus a stick go faster than one', () => {
    const v = clampLength(1, 1)
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1)
    expect(clampLength(0.3, 0.4)).toEqual({ x: 0.3, y: 0.4 })
  })
})
