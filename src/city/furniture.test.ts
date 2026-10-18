import { describe, expect, it } from 'vitest'
import { walkLoops } from '../life/places'
import { generateLand } from '../land/plan'
import { FURNITURE_HALF } from '../world/furniture-models'
import { furnitureFor } from './furniture'
import { CURB_H } from './layout'
import { contains, edgeDist } from './polygon'
import { surfaceAt } from './terrain'

describe('furnitureFor', () => {
  const city = generateLand(7, 1000)
  const avoid = [...city.palms, ...city.lights]
  const items = furnitureFor(city, avoid)

  it('puts every kind on a sidewalk, clear of palms and lights', () => {
    expect(new Set(items.map((f) => f.kind)).size).toBe(7)
    for (const f of items) {
      expect(surfaceAt(city, f.x, f.z)).toBeCloseTo(CURB_H)
      expect(city.blocks.some((b) => contains(b.lot, f))).toBe(false)
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
      const gap = Math.min(...loops.map((l) => edgeDist(l.pts, f)))
      expect(gap - FURNITURE_HALF[f.kind][2], f.kind).toBeGreaterThan(0.35)
    }
  })

  it('is the same every time', () => {
    expect(furnitureFor(city, avoid)).toEqual(items)
  })
})
