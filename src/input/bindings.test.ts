import { describe, expect, it } from 'vitest'
import { BINDINGS, moveAxes, type Action } from './bindings'

describe('moveAxes', () => {
  it('maps WASD codes to actions', () => {
    expect(BINDINGS.KeyW).toBe('forward')
    expect(BINDINGS.Space).toBe('jump')
  })

  it('returns zero when idle or when opposite keys cancel', () => {
    expect(moveAxes(new Set())).toEqual({ x: 0, z: 0 })
    expect(moveAxes(new Set<Action>(['left', 'right']))).toEqual({ x: 0, z: 0 })
  })

  it('normalizes diagonals', () => {
    const a = moveAxes(new Set<Action>(['forward', 'right']))
    expect(Math.hypot(a.x, a.z)).toBeCloseTo(1)
    expect(a.x).toBeGreaterThan(0)
    expect(a.z).toBeGreaterThan(0)
  })
})
