import { describe, expect, it } from 'vitest'
import { roadRise } from '../city/canal-bridge'
import { surfaceAt } from '../city/terrain'
import { generateLand } from '../land/plan'
import { cityLaneGraph } from './city-lane-graph'

const land = generateLand(7, 1000)
const edges = cityLaneGraph(land)

/** Edges reachable from `from` following `next` (or the reverse links). */
function reach(from: number, links: number[][]): Set<number> {
  const seen = new Set([from])
  const todo = [from]
  while (todo.length)
    for (const n of links[todo.pop()!]) if (!seen.has(n) && seen.add(n)) todo.push(n)
  return seen
}

describe('city lane graph', () => {
  it('chains every lane into the next without gaps or dead ends', () => {
    expect(edges.length).toBeGreaterThan(500)
    for (const e of edges) {
      expect(e.next.length).toBeGreaterThan(0)
      const end = e.pts[e.pts.length - 1]
      for (const n of e.next) {
        const start = edges[n].pts[0]
        expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeLessThan(1e-6)
      }
    }
  })

  it('lets a car get from any lane to any other', () => {
    const fwd = edges.map((e) => e.next)
    const back: number[][] = edges.map(() => [])
    edges.forEach((e, i) => e.next.forEach((n) => back[n].push(i)))
    expect(reach(0, fwd).size).toBe(edges.length)
    expect(reach(0, back).size).toBe(edges.length)
  })

  it('keeps every lane on the road, over the humps where it crosses the canal', () => {
    for (const e of edges) {
      for (const p of e.pts) {
        expect(surfaceAt(land, p.x, p.z), `${p.x.toFixed(1)}, ${p.z.toFixed(1)}`).toBeCloseTo(
          roadRise(land, p.x, p.z),
          3,
        )
        expect(p.y).toBeCloseTo(roadRise(land, p.x, p.z), 3)
      }
    }
    expect(edges.some((e) => e.pts.some((p) => p.y > 1))).toBe(true)
  })

  it('stops lanes at lights where avenues meet and at stop signs elsewhere', () => {
    const stops = edges.filter((e) => e.stop)
    expect(stops.some((e) => e.stop!.signal)).toBe(true)
    expect(stops.some((e) => !e.stop!.signal)).toBe(true)
    for (const e of stops) {
      expect(land.junctions[e.stop!.junction].control).toBe(e.stop!.signal ? 'signal' : 'stop')
    }
  })
})
