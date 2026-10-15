import { describe, expect, it } from 'vitest'
import { generateCity } from './layout'
import { pathLength, route, snap } from './route'

const grid = { xRoads: [0, 100, 200, 300], zRoads: [0, 100, 200] }

describe('route', () => {
  it('snaps a point to the nearest road', () => {
    expect(snap(grid, { x: 30, z: 4 }).at).toEqual({ x: 30, z: 0 })
    expect(snap(grid, { x: 196, z: 150 }).at).toEqual({ x: 200, z: 150 })
  })

  it('stays on one block when both ends share it', () => {
    expect(route(grid, { x: 10, z: 2 }, { x: 80, z: -3 })).toEqual([
      { x: 10, z: 0 },
      { x: 80, z: 0 },
    ])
  })

  it('finds a shortest path along roads through intersections', () => {
    const path = route(grid, { x: 50, z: 2 }, { x: 298, z: 150 })
    expect(path[0]).toEqual({ x: 50, z: 0 })
    expect(path[path.length - 1]).toEqual({ x: 300, z: 150 })
    // Manhattan distance between the snapped ends is the best any grid route can do.
    expect(pathLength(path)).toBeCloseTo(250 + 150)
    // Every leg runs along one axis: the route never cuts across a block.
    for (let k = 1; k < path.length; k++) {
      const [p, q] = [path[k - 1], path[k]]
      expect(p.x === q.x || p.z === q.z).toBe(true)
    }
  })

  it('routes across the real city', () => {
    const city = generateCity(7, 2000)
    const path = route(city, city.spawn, { x: -900, z: -900 })
    expect(path.length).toBeGreaterThan(2)
    expect(pathLength(path)).toBeLessThan(2 * 2000)
  })
})
