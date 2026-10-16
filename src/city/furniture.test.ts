import { describe, expect, it } from 'vitest'
import { furnitureFor } from './furniture'
import { generateCity } from './layout'

describe('furnitureFor', () => {
  const city = generateCity(7, 1000)
  const avoid = [...city.palms, ...city.lights]
  const items = furnitureFor(city, avoid)

  it('puts every kind on a sidewalk, clear of palms and lights', () => {
    expect(new Set(items.map((f) => f.kind)).size).toBe(7)
    for (const f of items) {
      const block = city.blocks.find(
        (b) => f.x >= b.rect.x0 && f.x <= b.rect.x1 && f.z >= b.rect.z0 && f.z <= b.rect.z1,
      )
      expect(block).toBeDefined()
      const inLot =
        f.x > block!.lot.x0 && f.x < block!.lot.x1 && f.z > block!.lot.z0 && f.z < block!.lot.z1
      expect(inLot).toBe(false)
    }
    const nearest = Math.min(
      ...items.map((f) => Math.min(...avoid.map((a) => Math.hypot(a.x - f.x, a.z - f.z)))),
    )
    expect(nearest).toBeGreaterThan(1.5)
  })

  it('is the same every time', () => {
    expect(furnitureFor(city, avoid)).toEqual(items)
  })
})
