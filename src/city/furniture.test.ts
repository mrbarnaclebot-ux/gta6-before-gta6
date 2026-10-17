import { describe, expect, it } from 'vitest'
import { walkLoops } from '../life/places'
import { FURNITURE_HALF } from '../world/furniture-models'
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

  it('leaves the line people walk clear, so nobody walks through a bus shelter or bench', () => {
    const loops = walkLoops(city)
    for (const f of items) {
      // Distance from the item's center to the nearest walking line, less its depth.
      const gap = Math.min(
        ...loops.map((l) =>
          f.x > l.x0 - 4 && f.x < l.x1 + 4 && f.z > l.z0 - 4 && f.z < l.z1 + 4
            ? Math.min(
                Math.abs(f.x - l.x0),
                Math.abs(f.x - l.x1),
                Math.abs(f.z - l.z0),
                Math.abs(f.z - l.z1),
              )
            : Infinity,
        ),
      )
      expect(gap - FURNITURE_HALF[f.kind][2], f.kind).toBeGreaterThan(0.35)
    }
  })

  it('is the same every time', () => {
    expect(furnitureFor(city, avoid)).toEqual(items)
  })
})
