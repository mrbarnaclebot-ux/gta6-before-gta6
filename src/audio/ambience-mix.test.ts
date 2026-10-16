import { describe, expect, it } from 'vitest'
import { bedWeights, type Bed, type Place } from './ambience-mix'

const DOWNTOWN: Place = {
  inland: 400,
  marina: 900,
  height: 2,
  forest: 0,
  night: 0,
  underwater: false,
}
const loudest = (p: Place) => {
  const w = bedWeights(p)
  return (Object.keys(w) as Bed[]).sort((a, b) => w[b] - w[a])[0]
}

describe('bedWeights', () => {
  it('picks the right bed for each kind of place', () => {
    expect(loudest(DOWNTOWN)).toBe('city')
    expect(loudest({ ...DOWNTOWN, night: 1 })).toBe('night')
    expect(loudest({ ...DOWNTOWN, inland: -10 })).toBe('beach')
    expect(loudest({ ...DOWNTOWN, inland: -10, marina: 10 })).toBe('marina')
    expect(loudest({ ...DOWNTOWN, height: 80 })).toBe('wind')
    expect(loudest({ ...DOWNTOWN, forest: 1 })).toBe('forest')
  })

  it('leaves the town behind out at sea', () => {
    const w = bedWeights({ ...DOWNTOWN, inland: -400 })
    expect(w.city).toBe(0)
    expect(w.beach).toBe(1)
  })

  it('hears only the underwater hum below the surface', () => {
    const w = bedWeights({ ...DOWNTOWN, underwater: true })
    expect(w.underwater).toBe(1)
    expect(w.city + w.beach + w.night).toBe(0)
  })

  it('never adds up to more power than one bed at full', () => {
    for (const inland of [-50, 0, 30, 80, 200]) {
      for (const night of [0, 0.5, 1]) {
        const w = bedWeights({ ...DOWNTOWN, inland, night, forest: 0.4, height: 30 })
        const power = Object.values(w).reduce((s, v) => s + v * v, 0)
        expect(power).toBeLessThanOrEqual(1.0001)
      }
    }
  })
})
