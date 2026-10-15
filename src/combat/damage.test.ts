import { describe, expect, it } from 'vitest'
import { carCondition, damageAt, hurt, MAX_RANGE, PISTOL_DAMAGE } from './damage'

describe('damage', () => {
  it('falls off with range and doubles on head shots', () => {
    expect(damageAt(5)).toBe(PISTOL_DAMAGE)
    expect(damageAt(200)).toBeCloseTo(PISTOL_DAMAGE * 0.4)
    expect(damageAt(60)).toBeLessThan(PISTOL_DAMAGE)
    expect(damageAt(MAX_RANGE + 1)).toBe(0)
    expect(damageAt(5, 1.6)).toBe(PISTOL_DAMAGE * 2)
  })

  it('reports the killing hit once and never goes below zero', () => {
    const h = { hp: 40, max: 100 }
    expect(hurt(h, 25)).toBe(false)
    expect(hurt(h, 25)).toBe(true)
    expect(h.hp).toBe(0)
    expect(hurt(h, 25)).toBe(false)
  })

  it('smokes a car at low health and wrecks it at zero', () => {
    expect(carCondition({ hp: 100, max: 100 })).toBe('intact')
    expect(carCondition({ hp: 30, max: 100 })).toBe('smoking')
    expect(carCondition({ hp: 0, max: 100 })).toBe('wrecked')
  })
})
