import { describe, expect, it } from 'vitest'
import { PAD, padActions, padAxes } from './pad-map'

const only =
  (...down: number[]) =>
  (b: number) =>
    down.includes(b) ? 1 : 0

describe('padActions', () => {
  it('maps the face buttons, shoulders, triggers, Back, and Start', () => {
    const all = padActions(
      only(PAD.A, PAD.X, PAD.Y, PAD.LB, PAD.RB, PAD.LT, PAD.RT, PAD.BACK, PAD.START),
      'walking',
    )
    expect([...all].sort()).toEqual(
      ['aim', 'fire', 'jump', 'map', 'pause', 'radioNext', 'radioPrev', 'reload', 'use'].sort(),
    )
  })

  it('makes B run on foot and dive in water, and L3 the horn in a car', () => {
    expect(padActions(only(PAD.B), 'walking')).toEqual(new Set(['run']))
    expect(padActions(only(PAD.B), 'swimming')).toEqual(new Set(['dive']))
    expect(padActions(only(PAD.L3), 'driving')).toEqual(new Set(['horn']))
  })

  it('treats a lightly touched trigger as not pressed', () => {
    expect(padActions((b) => (b === PAD.RT ? 0.3 : 0), 'walking').size).toBe(0)
  })
})

describe('padAxes', () => {
  it('turns stick up into forward and the triggers into a pedal', () => {
    const { drive, look } = padAxes([0, -1, 1, 0], only(PAD.RT))
    expect(drive.z).toBeCloseTo(1)
    expect(drive.throttle).toBe(1)
    expect(look.x).toBeCloseTo(1)
    expect(padAxes([0, 0, 0, 0], only(PAD.LT)).drive.throttle).toBe(-1)
  })
})
