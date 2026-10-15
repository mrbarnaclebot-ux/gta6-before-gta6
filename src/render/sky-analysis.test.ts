import { describe, expect, it } from 'vitest'
import { horizonColor, sunDirection } from './sky-analysis'

describe('sunDirection', () => {
  it('finds a bright pixel in the top row as a high sun', () => {
    const w = 8
    const h = 4
    const data = new Float32Array(w * h * 4).fill(0.1)
    data[(0 * w + 2) * 4 + 1] = 100
    const [x, y, z] = sunDirection(data, w, h)
    expect(y).toBeGreaterThan(0.9)
    expect(Math.hypot(x, y, z)).toBeCloseTo(1)
  })

  it('ignores bright pixels below the horizon', () => {
    const data = new Float32Array(4 * 4 * 4).fill(0.1)
    data[(3 * 4 + 1) * 4] = 100
    expect(sunDirection(data, 4, 4)[1]).toBeGreaterThan(0)
  })
})

describe('horizonColor', () => {
  it('averages the row just above the middle', () => {
    const w = 2
    const h = 100
    const data = new Float32Array(w * h * 4).fill(0.5)
    expect(horizonColor(data, w, h)).toEqual([0.5, 0.5, 0.5])
  })
})
