import { describe, expect, it } from 'vitest'
import { generateCity } from '../city/layout'
import { surfaceAt } from '../city/terrain'
import { hospitals, loopPoint, nearest, perimeter, walkLoops } from './places'

const city = generateCity(7, 1000)

describe('walk loops and hospitals', () => {
  it('walks every loop on raised sidewalk, never on the road or a lawn', () => {
    for (const loop of walkLoops(city)) {
      for (let s = 0; s < perimeter(loop); s += 5) {
        const p = loopPoint(loop, s)
        expect(surfaceAt(city, p.x, p.z)).toBeCloseTo(0.15)
      }
    }
  })

  it('wraps around and runs clockwise', () => {
    const loop = { x0: 0, z0: 0, x1: 10, z1: 20 }
    expect(loopPoint(loop, 5)).toMatchObject({ x: 5, z: 0, dx: 1 })
    expect(loopPoint(loop, 65)).toMatchObject({ x: 5, z: 0 })
    expect(loopPoint(loop, -5)).toMatchObject({ x: 0, z: 5, dz: -1 })
  })

  it('puts one hospital in each district and finds the nearest', () => {
    const list = hospitals(city)
    expect(list).toHaveLength(4)
    for (const h of list) expect(surfaceAt(city, h.x, h.z)).toBeCloseTo(0.15)
    expect(nearest(list, list[2].x + 3, list[2].z)).toBe(list[2])
  })
})
