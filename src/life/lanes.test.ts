import { describe, expect, it } from 'vitest'
import { generateCity, ROAD_HALF } from '../city/layout'
import { rng } from '../city/rng'
import { lanePoint, nextLeg, randomHeading, type Heading } from './lanes'

const city = generateCity(7, 1000)

/** True if (x, z) lies on some road of the grid. */
const onRoad = (x: number, z: number) =>
  city.roads.some((r) =>
    r.axis === 'x'
      ? Math.abs(z - r.at) <= ROAD_HALF && x >= r.from && x <= r.to
      : Math.abs(x - r.at) <= ROAD_HALF && z >= r.from && z <= r.to,
  )

describe('traffic lanes', () => {
  it('chains legs end to end along roads without U-turns', () => {
    const r = rng(3)
    for (let car = 0; car < 20; car++) {
      let h: Heading = randomHeading(city, r)
      for (let leg = 0; leg < 40; leg++) {
        const { points, next } = nextLeg(city, h, r)
        for (const p of points) expect(onRoad(p.x, p.z)).toBe(true)
        const end = points[points.length - 1]
        const start = lanePoint(next, next.u)
        expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeLessThan(1e-6)
        if (next.axis === h.axis) expect(next.dir).toBe(h.dir)
        h = next
      }
    }
  })

  it('keeps right: a car heading +z drives on the -x side of the centerline', () => {
    const p = lanePoint({ axis: 'z', at: 100, dir: 1 }, 0)
    expect(p.x).toBeLessThan(100)
  })
})
