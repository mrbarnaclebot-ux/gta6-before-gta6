import { describe, expect, it } from 'vitest'
import { grade } from './grade'

describe('color grade', () => {
  it('keeps black and white', () => {
    expect(grade([0, 0, 0])).toEqual([0, 0, 0])
    grade([1, 1, 1]).forEach((v) => expect(v).toBeCloseTo(1))
  })

  it('warms highlights and cools shadows', () => {
    const [hr, , hb] = grade([0.75, 0.75, 0.75])
    expect(hr).toBeGreaterThan(hb)
    const [sr, , sb] = grade([0.2, 0.2, 0.2])
    expect(sb).toBeGreaterThan(sr)
  })

  it('adds contrast and saturation', () => {
    expect(grade([0.2, 0.2, 0.2])[1]).toBeLessThan(0.2)
    expect(grade([0.8, 0.8, 0.8])[1]).toBeGreaterThan(0.8)
    const [r, g, b] = grade([0.6, 0.4, 0.3])
    expect(r - b).toBeGreaterThan(0.3)
    expect(g).toBeGreaterThan(0)
  })

  it('stays in range', () => {
    for (const c of [
      [1, 0, 0],
      [0, 1, 1],
      [0.05, 0.9, 0.2],
    ] as [number, number, number][]) {
      for (const v of grade(c)) expect(v).toBeGreaterThanOrEqual(0)
      for (const v of grade(c)) expect(v).toBeLessThanOrEqual(1)
    }
  })
})
