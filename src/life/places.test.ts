import { describe, expect, it } from 'vitest'
import { generateLand } from '../land/plan'
import { surfaceAt } from '../city/terrain'
import { CURB_H } from '../city/layout'
import { hospitals, loopPoint, loopStation, nearest, walkLoops } from './places'
import { crossings } from './crossings'

const city = generateLand(7, 1000)
const loops = walkLoops(city)

describe('walk loops, crosswalks, and hospitals', () => {
  it('walks every loop on raised sidewalk, never on the road or a lawn', () => {
    expect(loops.length).toBeGreaterThan(80)
    for (const loop of loops) {
      for (let s = 0; s < loop.length; s += 4) {
        const p = loopPoint(loop, s)
        expect(surfaceAt(city, p.x, p.z), `${p.x.toFixed(1)}, ${p.z.toFixed(1)}`).toBeCloseTo(
          CURB_H,
        )
      }
    }
  })

  it('wraps around either way and finds the station of a point', () => {
    const l = loops[0]
    const p = loopPoint(l, 10)
    expect(loopPoint(l, 10 + l.length)).toMatchObject({ x: p.x, z: p.z })
    expect(loopPoint(l, 10 - l.length).x).toBeCloseTo(p.x)
    expect(loopStation(l, p)).toBeCloseTo(10, 3)
  })

  it('links loops across the street at every crosswalk, both ways, over the road', () => {
    const list = crossings(city, loops)
    expect(list.length).toBeGreaterThan(200)
    for (const c of list) {
      expect(c.from).not.toBe(c.to)
      const back = list.find((o) => o.from === c.to && o.to === c.from && o.junction === c.junction)
      expect(back).toBeDefined()
      const mid = { x: (c.a.x + c.b.x) / 2, z: (c.a.z + c.b.z) / 2 }
      expect(surfaceAt(city, mid.x, mid.z)).toBe(0)
      const len = Math.hypot(c.b.x - c.a.x, c.b.z - c.a.z)
      expect(len).toBeGreaterThan(10)
      expect(len).toBeLessThan(30)
    }
  })

  it('puts one hospital in each district and finds the nearest', () => {
    const list = hospitals(city)
    expect(list).toHaveLength(4)
    for (const h of list) expect(surfaceAt(city, h.x, h.z)).toBeCloseTo(CURB_H)
    expect(nearest(list, list[2].x + 3, list[2].z)).toBe(list[2])
  })
})
