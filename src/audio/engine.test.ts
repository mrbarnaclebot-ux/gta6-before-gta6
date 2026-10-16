import { describe, expect, it } from 'vitest'
import { boatMix, doppler, engineMix, IDLE_RPM, impact, LAYER_RPM, REDLINE, rpmFor } from './engine'

describe('rpmFor', () => {
  it('idles at rest and revs with the throttle at a standstill', () => {
    expect(rpmFor(0, 0)).toBe(IDLE_RPM)
    expect(rpmFor(0, 1)).toBeGreaterThan(2000)
  })

  it('climbs through a gear and drops at the shift', () => {
    expect(rpmFor(7, 1)).toBeGreaterThan(rpmFor(3, 1))
    expect(rpmFor(9, 1)).toBeLessThan(rpmFor(7.9, 1))
  })

  it('stays between idle and the redline, in reverse too', () => {
    for (const v of [-20, -3, 0, 5, 30, 90]) {
      const r = rpmFor(v, 1)
      expect(r).toBeGreaterThanOrEqual(IDLE_RPM)
      expect(r).toBeLessThanOrEqual(REDLINE)
    }
  })
})

describe('engineMix', () => {
  it('plays a recorded loop at its own pitch at its own rpm', () => {
    LAYER_RPM.forEach((rpm, i) => {
      const m = engineMix(rpm, 1)
      expect(m.rates[i]).toBeCloseTo(1)
      expect(Math.max(...m.gains)).toBeCloseTo(m.gains[i])
    })
  })

  it('crossfades at equal power between two neighbors', () => {
    const m = engineMix(3000, 1)
    const power = m.gains.reduce((s, g) => s + g * g, 0)
    expect(power).toBeCloseTo(1)
    expect(m.gains[1]).toBeGreaterThan(0)
    expect(m.gains[2]).toBeGreaterThan(0)
    expect(m.gains[0]).toBe(0)
  })

  it('is quieter off the throttle', () => {
    const on = Math.max(...engineMix(3000, 1).gains)
    const off = Math.max(...engineMix(3000, 0).gains)
    expect(off).toBeLessThan(on)
  })
})

describe('boat, crash, and doppler', () => {
  it('pitches the outboard up with speed', () => {
    expect(boatMix(18, 1).rate).toBeGreaterThan(boatMix(0, 0).rate)
    expect(boatMix(0, 0).wake).toBe(0)
  })

  it('tells a crash from braking', () => {
    expect(impact(0.15, 1 / 60)).toBe(0)
    expect(impact(8, 1 / 60)).toBeGreaterThan(0.5)
  })

  it('raises the pitch of something coming closer', () => {
    expect(doppler(20)).toBeGreaterThan(1)
    expect(doppler(-20)).toBeLessThan(1)
  })
})
