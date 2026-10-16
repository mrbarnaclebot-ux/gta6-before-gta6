import { describe, expect, it } from 'vitest'
import { bakeSeaField, seaAt } from './field'
import { displace, MAX_WAVE, SURF, surfHeight, waveHeightAt, type SeaSample } from './waves'

const open = (): SeaSample => ({ scale: 1, shore: 1e4 })

describe('waveHeightAt', () => {
  it('finds the height of the displaced vertex that lands on the query point', () => {
    for (let i = 0; i < 50; i++) {
      const x = i * 13.7 - 300
      const z = i * 7.3 + 40
      const t = i * 0.77
      const [dx, dy, dz] = displace(x, z, t, open())
      expect(Math.abs(waveHeightAt(x + dx, z + dz, t) - dy)).toBeLessThan(0.001)
    }
  })

  it('stays within the summed crest heights and moves over time', () => {
    const hs = Array.from({ length: 200 }, (_, i) => waveHeightAt(10, 20, i * 0.31))
    expect(Math.max(...hs.map(Math.abs))).toBeLessThan(MAX_WAVE)
    expect(Math.max(...hs) - Math.min(...hs)).toBeGreaterThan(0.2)
  })

  it('is calmer where the field scales the waves down', () => {
    const calm = (): SeaSample => ({ scale: 0.15, shore: 1e4 })
    const range = (at: () => SeaSample) => {
      const hs = Array.from({ length: 200 }, (_, i) => waveHeightAt(5, 5, i * 0.29, at))
      return Math.max(...hs) - Math.min(...hs)
    }
    expect(range(calm)).toBeLessThan(range(open) * 0.25)
  })

  it('surf averages to the still level over one period and is gone offshore', () => {
    const s = { scale: 1, shore: 20 }
    const n = 400
    let sum = 0
    for (let i = 0; i < n; i++) sum += surfHeight(0, 0, (i / n) * SURF.period, s)
    expect(Math.abs(sum / n)).toBeLessThan(0.001)
    expect(surfHeight(0, 0, 1, { scale: 1, shore: SURF.from + 1 })).toBe(0)
  })
})

describe('bakeSeaField', () => {
  // A beach rising 1 m per 10 m toward -x; the water's edge is at x = 0.
  const field = bakeSeaField(
    (x) => -x / 10,
    0,
    { x0: -40, z0: -10, x1: 60, z1: 10 },
    { x0: 0, x1: 0, z0: 0, z1: 0 },
  )

  it('gives signed shore distance: positive at sea, negative inland', () => {
    expect(seaAt(field, 30, 0).shore).toBeGreaterThan(26)
    expect(seaAt(field, 30, 0).shore).toBeLessThan(32)
    expect(seaAt(field, -20, 0).shore).toBeLessThan(-16)
  })

  it('shrinks waves in the shallows but keeps a lap at the waterline', () => {
    expect(seaAt(field, 50, 0).scale).toBeCloseTo(1, 2)
    expect(seaAt(field, 1, 0).scale).toBeGreaterThan(0.15)
    expect(seaAt(field, 1, 0).scale).toBeLessThan(0.35)
  })
})
