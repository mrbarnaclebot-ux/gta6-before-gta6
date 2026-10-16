import { describe, expect, it } from 'vitest'
import { ringPlan, tileDistance, tileIndex, tileKey, type Tile } from './rings'

const S = 128
const grid = (n: number): Tile[] =>
  Array.from({ length: n * n }, (_, k) => {
    const i = (k % n) - n / 2
    const j = Math.floor(k / n) - n / 2
    return { key: tileKey(i, j), i, j }
  })
const R = { load: 150, unload: 220 }

describe('tile rings', () => {
  it('indexes negative coordinates by floor', () => {
    expect(tileIndex(-0.1, S)).toBe(-1)
    expect(tileIndex(127.9, S)).toBe(0)
    expect(tileIndex(128, S)).toBe(1)
  })

  it('measures to the tile edge, zero inside', () => {
    expect(tileDistance(0, 0, S, { x: 10, z: 10 })).toBe(0)
    expect(tileDistance(1, 0, S, { x: 100, z: 10 })).toBe(28)
    expect(tileDistance(1, 1, S, { x: 125, z: 124 })).toBe(5)
  })

  it('loads the ring nearest first and nothing outside it', () => {
    const { load, unload } = ringPlan(grid(20), new Set(), [{ x: 64, z: 64 }], S, R)
    expect(load[0]).toEqual({ key: '0,0', d: 0 })
    expect(load.every((t, k) => k === 0 || t.d >= load[k - 1].d)).toBe(true)
    expect(load.every((t) => t.d <= R.load)).toBe(true)
    // Neighbours are 64 m away (90 m diagonally), the next ring 192 m: the 3x3 block.
    expect(load.length).toBe(9)
    expect(unload).toEqual([])
  })

  it('keeps a loaded tile until the focus is past the unload radius (hysteresis)', () => {
    const tiles = grid(20)
    const loaded = new Set(['3,0'])
    // 3,0 spans x 384..512: 200 m from x = 184 is inside unload, outside load.
    expect(ringPlan(tiles, loaded, [{ x: 184, z: 64 }], S, R).unload).not.toContain('3,0')
    expect(
      ringPlan(tiles, new Set(), [{ x: 184, z: 64 }], S, R).load.map((t) => t.key),
    ).not.toContain('3,0')
    expect(ringPlan(tiles, loaded, [{ x: 150, z: 64 }], S, R).unload).toContain('3,0')
  })

  it('a tile near any focus stays', () => {
    const loaded = new Set(['-5,0'])
    const foci = [
      { x: 1000, z: 0 },
      { x: -600, z: 10 },
    ]
    expect(ringPlan(grid(20), loaded, foci, S, R).unload).not.toContain('-5,0')
  })
})
