import { describe, expect, it } from 'vitest'
import { generateFlora } from './flora'
import { GRASS_TILE } from './grass'
import { outerLandmarks } from './landmarks'
import { LAWN_CELL, LAWN_CELLS, lawnTile, PATCH_STRIDE } from './lawn'
import { generateLand } from './plan'

const land = generateLand(7, 1000)
const { clear } = generateFlora(land)

describe('lawn tiles', () => {
  it('line up with the clump tiles, cover a meadow densely, and stay in their square', () => {
    expect(LAWN_CELL * LAWN_CELLS).toBeCloseTo(GRASS_TILE)
    const { hillside } = outerLandmarks(land)
    const [ti, tj] = [Math.floor(hillside.x / GRASS_TILE), Math.floor(hillside.z / GRASS_TILE)]
    const a = lawnTile(land, clear, ti, tj)
    expect(a.length / PATCH_STRIDE).toBeGreaterThan(LAWN_CELLS * LAWN_CELLS * 0.4)
    expect(lawnTile(land, clear, ti, tj)).toEqual(a)
    for (let k = 0; k < a.length; k += PATCH_STRIDE) {
      expect(Math.floor(a[k] / GRASS_TILE)).toBe(ti)
      expect(Math.floor(a[k + 2] / GRASS_TILE)).toBe(tj)
      // The tilt is a unit ground normal's x and z.
      expect(Math.hypot(a[k + 4], a[k + 5])).toBeLessThan(1)
    }
  })
})
