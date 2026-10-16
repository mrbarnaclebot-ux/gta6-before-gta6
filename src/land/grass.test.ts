import { describe, expect, it } from 'vitest'
import { GrassTiles } from '../scenery/grass-tiles'
import { generateFlora } from './flora'
import { CLUMP_STRIDE, GRASS_TILE, grassTile } from './grass'
import { outerLandmarks } from './landmarks'
import { generateLand } from './plan'

const land = generateLand(7, 1000)
const { clear } = generateFlora(land)

describe('grass tiles', () => {
  it('are the same each time, cheap to build, and stay inside their square', () => {
    const { hillside } = outerLandmarks(land)
    const [ti, tj] = [Math.floor(hillside.x / GRASS_TILE), Math.floor(hillside.z / GRASS_TILE)]
    const a = grassTile(land, clear, ti, tj)
    // Fastest of a few warm runs: one cold call on a shared CI runner measures the JIT, not the code.
    const ms = Math.min(
      ...Array.from({ length: 5 }, () => {
        const t0 = performance.now()
        grassTile(land, clear, ti, tj)
        return performance.now() - t0
      }),
    )
    expect(a.length / CLUMP_STRIDE).toBeGreaterThan(200)
    expect(grassTile(land, clear, ti, tj)).toEqual(a)
    for (let k = 0; k < a.length; k += CLUMP_STRIDE) {
      expect(Math.floor(a[k] / GRASS_TILE)).toBe(ti)
      expect(Math.floor(a[k + 2] / GRASS_TILE)).toBe(tj)
    }
    // A frame's grass budget is 2 ms; one tile must fit it with room on a slower machine.
    expect(ms).toBeLessThan(10)
  })

  it('are built nearest first within the budget, and dropped once far away', () => {
    const built: string[] = []
    const tiles = new GrassTiles((i, j) => (built.push(`${i},${j}`), new Float32Array(0)))
    expect(tiles.fill(5, 5, 42, -1)).toBe(true)
    expect(built).toEqual(['0,0'])
    while (tiles.fill(5, 5, 42, Infinity));
    const count = (r: number) => {
      let n = 0
      tiles.forEach(5, 5, r, () => n++)
      return n
    }
    expect(count(1)).toBe(1)
    expect(count(200)).toBe(tiles.size)
    while (tiles.fill(5000, 5, 42, Infinity));
    expect(count(200)).toBe(0)
  })
})
