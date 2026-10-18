import { describe, expect, it } from 'vitest'
import { heightAt } from '../city/terrain'
import { MAX_GRADE } from './highway'
import { laneGraph } from './lane-graph'
import { generateLand } from './plan'
import { closest, dist } from './polyline'
import { maxGrade } from './profile'
import { roadGraph } from './road-graph'
import { route } from './route-search'

const land = generateLand(7, 1000)
const named = (name: string) => land.paths.find((p) => p.name === name)!
const highway = named('highway')
const ramps = land.paths.filter((p) => p.kind === 'ramp')

describe('highway', () => {
  it('keeps the main line and every ramp within the grade limit', () => {
    for (const p of [highway, ...ramps])
      expect(maxGrade(p.pts), p.name).toBeLessThanOrEqual(MAX_GRADE + 1e-6)
    expect(ramps).toHaveLength(8)
  })

  it('bridges both crossing roads with room for a truck underneath', () => {
    for (const name of ['Hill Road', 'Palm Avenue']) {
      const road = named(name)
      const at =
        highway.pts[
          closest(highway.pts, road.pts[closest(road.pts, { x: -640, z: road.pts[0].z }).i]).i
        ]
      const under = road.pts[closest(road.pts, at).i]
      // Deck surface minus the 1.3 m deck, over the road surface.
      expect(at.y - 1.3 - under.y, name).toBeGreaterThan(4.5)
      expect(at.y - heightAt(land, at.x, at.z)).toBeGreaterThan(5)
    }
  })

  it('keeps Hillside Drive drivable', () => {
    expect(maxGrade(named('Hillside Drive').pts)).toBeLessThanOrEqual(0.0851)
  })
})

describe('highway lanes', () => {
  const edges = laneGraph(highway, ramps)

  it('joins every edge to the next without a gap', () => {
    for (const e of edges) {
      expect(e.next.length).toBeGreaterThan(0)
      for (const n of e.next) expect(dist(e.pts.at(-1)!, edges[n].pts[0])).toBeLessThan(0.5)
    }
  })

  it('lets a car reach every lane and ramp from every other', () => {
    for (let from = 0; from < edges.length; from++) {
      const seen = new Set([from])
      const todo = [from]
      while (todo.length)
        for (const n of edges[todo.pop()!].next) if (!seen.has(n)) todo.push(seen.add(n) && n)
      expect(seen.size, `from edge ${from}`).toBe(edges.length)
    }
  })

  it('climbs onto the bridges: lanes carry the deck heights', () => {
    const top = Math.max(...edges.flatMap((e) => e.pts.map((p) => p.y)))
    expect(top).toBeGreaterThan(Math.max(...ramps.flatMap((r) => r.pts.map((p) => p.y))) + 3)
  })
})

describe('GPS road graph', () => {
  const g = roadGraph(land, land.paths)

  it('connects every road on the map', () => {
    const seen = new Set([0])
    const todo = [0]
    while (todo.length)
      for (const l of g.links[todo.pop()!]) if (!seen.has(l.to)) todo.push(seen.add(l.to) && l.to)
    expect(seen.size).toBe(g.pts.length)
  })

  it('routes from the spawn to the summit up Hill Road and the switchbacks', () => {
    const path = route(g, land.spawn, land.lookout)
    const hill = named('Hillside Drive')
    expect(path.some((p) => closest(hill.pts, p).d < 1)).toBe(true)
    // The drive ends where the road reaches the lookout, at the edge of the level summit.
    expect(dist(path.at(-1)!, land.lookout)).toBeLessThan(45)
  })

  it('takes the highway between the far ends of the map', () => {
    const north = { x: -1300, z: -760 }
    const south = { x: 300, z: 830 }
    const path = route(g, { x: -640, z: -650 }, south)
    expect(path.some((p) => closest(highway.pts, p).d < 1)).toBe(true)
    expect(route(g, north, south).length).toBeGreaterThan(2)
  })

  it('cuts across the city by the diagonal boulevard', () => {
    const diag = land.net.lines.find((l) => l.name === 'diagonal')!.pts
    const path = route(g, { x: -440, z: 490 }, { x: -10, z: 60 })
    const on = path.filter((p) => closest(diag, p).d < 1).length
    expect(on / path.length).toBeGreaterThan(0.6)
  })
})
