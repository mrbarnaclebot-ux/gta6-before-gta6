import { describe, expect, it } from 'vitest'
import { fire, FIRE_INTERVAL, MAG_SIZE, newPistol, reload, RELOAD_TIME, tick } from './weapon'

describe('pistol', () => {
  it('limits the fire rate', () => {
    const p = newPistol()
    expect(fire(p)).toBe(true)
    expect(fire(p)).toBe(false)
    tick(p, FIRE_INTERVAL)
    expect(fire(p)).toBe(true)
    expect(p.mag).toBe(MAG_SIZE - 2)
  })

  it('auto-reloads an empty magazine from the reserve', () => {
    const p = newPistol()
    const reserve = p.reserve
    for (let i = 0; i < MAG_SIZE; i++) {
      expect(fire(p)).toBe(true)
      tick(p, FIRE_INTERVAL)
    }
    expect(p.mag).toBe(0)
    expect(p.reloading).toBeGreaterThan(0)
    expect(fire(p)).toBe(false)
    tick(p, RELOAD_TIME)
    expect(p.mag).toBe(MAG_SIZE)
    expect(p.reserve).toBe(reserve - MAG_SIZE)
  })

  it('reloads a partial magazine and refuses when full or out of reserve', () => {
    const p = newPistol()
    expect(reload(p)).toBe(false)
    fire(p)
    expect(reload(p)).toBe(true)
    expect(reload(p)).toBe(false)
    tick(p, RELOAD_TIME)
    expect(p.mag).toBe(MAG_SIZE)
    Object.assign(p, { mag: 3, reserve: 2 })
    reload(p)
    tick(p, RELOAD_TIME)
    expect([p.mag, p.reserve]).toEqual([5, 0])
    fire(p)
    expect(reload(p)).toBe(false)
  })
})
