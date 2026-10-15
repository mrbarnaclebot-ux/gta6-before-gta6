import { describe, expect, it } from 'vitest'
import { animState, fall, GRAVITY, JUMP_SPEED, steer, turnToward, type Motion } from './movement'

const still = (): Motion => ({ vx: 0, vz: 0, vy: 0, airTime: 0 })

describe('movement', () => {
  it('accelerates toward the wished velocity without overshooting', () => {
    const m = still()
    steer(m, 0, -6, 0.1)
    expect(m.vz).toBeLessThan(0)
    expect(m.vz).toBeGreaterThan(-6)
  })

  it('jumps only when grounded or within coyote time', () => {
    const m = still()
    expect(fall(m, true, true, 0.016)).toBe(true)
    expect(m.vy).toBe(JUMP_SPEED)
    expect(fall(m, false, true, 0.016)).toBe(false)
    expect(m.vy).toBeCloseTo(JUMP_SPEED + GRAVITY * 0.016)
  })

  it('reports jump, fall, run, and idle states', () => {
    expect(animState(still())).toBe('idle')
    expect(animState({ vx: 6, vz: 0, vy: 0, airTime: 0 })).toBe('run')
    expect(animState({ vx: 0, vz: 0, vy: 3, airTime: 1 })).toBe('jump')
    expect(animState({ vx: 0, vz: 0, vy: -3, airTime: 1 })).toBe('fall')
  })

  it('turns along the shortest arc across the wrap point', () => {
    const next = turnToward(3.1, -3.1, 0.016)
    expect(next).toBeGreaterThan(3.1)
  })
})
