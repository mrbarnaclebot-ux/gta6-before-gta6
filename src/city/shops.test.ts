import { describe, expect, it } from 'vitest'
import { generateCity } from './layout'
import { buildingsFor } from './lots'
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
        const ox = s.x + s.nx * 4.01
        const oz = s.z + s.nz * 4.01
        const inLot =
          ox > block.lot.x0 && ox < block.lot.x1 && oz > block.lot.z0 && oz < block.lot.z1
        expect(inLot).toBe(false)
      }
    }
  })

  it('skips glass towers and is the same every time', () => {
    const tower = { ...city.blocks[0], district: 'deco' as const }
    tower.buildings = buildingsFor(tower.lot, 'deco', () => 0.5).buildings.map((b) => ({
      ...b,
      style: 'glass' as const,
    }))
    expect(shopsFor(tower)).toEqual([])
    expect(city.blocks.flatMap(shopsFor)).toEqual(shops)
  })
})
