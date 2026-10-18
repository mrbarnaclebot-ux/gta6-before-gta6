import { describe, expect, it } from 'vitest'
import { generateCity } from './layout'
import { contains } from './polygon'
import { SHOP_KINDS, shopsFor } from './shops'

describe('shopsFor', () => {
  const city = generateCity(7, 1000)
  const shops = city.blocks.flatMap(shopsFor)

  it('puts shops on low-rise street walls only, facing out of the lot', () => {
    expect(shops.length).toBeGreaterThan(50)
    for (const block of city.blocks) {
      for (const s of shopsFor(block)) {
        expect(block.district).not.toBe('downtown')
        expect(s.kind).toBeGreaterThanOrEqual(0)
        expect(s.kind).toBeLessThan(SHOP_KINDS)
        // A step out along the normal stays within a street gap of the lot edge.
        expect(contains(block.lot, { x: s.x + s.nx * 4.01, z: s.z + s.nz * 4.01 })).toBe(false)
      }
    }
  })

  it('skips glass towers and the towers on podiums, and is the same every time', () => {
    for (const block of city.blocks) {
      const ground = block.buildings.filter((b) => b.base === 0)
      for (const s of shopsFor(block)) {
        const on = (b: (typeof ground)[number]) =>
          Math.abs(Math.abs(s.x - b.x) * Math.abs(s.nx) - b.w / 2) < 1e-6 ||
          Math.abs(Math.abs(s.z - b.z) * Math.abs(s.nz) - b.d / 2) < 1e-6
        const wall = ground.find(
          (b) =>
            on(b) && Math.abs(s.x - b.x) <= b.w / 2 + 1e-6 && Math.abs(s.z - b.z) <= b.d / 2 + 1e-6,
        )
        expect(wall?.style).not.toBe('glass')
      }
    }
    expect(city.blocks.flatMap(shopsFor)).toEqual(shops)
  })
})
