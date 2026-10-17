import { describe, expect, it } from 'vitest'
import { DECK, HUMP, roadRise } from '../city/canal-bridge'
import { SEA_LEVEL } from '../city/layout'
import { heightAt, waterSurfaceAt } from '../city/terrain'
import { sandAt, seaward } from './coast'
import { CELL } from './grid'
import { DECK_FROM } from './path'
import { generateLand } from './plan'
import { closest, type P2 } from './polyline'

const land = generateLand(7, 1000)
const { coast } = land.frame
const g = land.ground

/** Water a boat can float in: at least 0.6 m deep at rest. */
const boatable = (i: number, j: number) => g.h[i * (g.nz + 1) + j] < SEA_LEVEL - 0.6

/** Grid cells reachable by water from `from`, never entering `blocked`; stops early once `goal` holds. */
function sail(from: P2, goal: (p: P2) => boolean, blocked: (p: P2) => boolean = () => false) {
  const n = g.nz + 1
  const seen = new Uint8Array((g.nx + 1) * n)
  const start = [Math.round((from.x - g.x0) / CELL), Math.round((from.z - g.z0) / CELL)]
  const todo = [start]
  seen[start[0] * n + start[1]] = 1
  while (todo.length) {
    const [i, j] = todo.pop()!
    const p = { x: g.x0 + i * CELL, z: g.z0 + j * CELL }
    if (goal(p)) return true
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const [a, b] = [i + di, j + dj]
      if (a < 0 || b < 0 || a > g.nx || b > g.nz || seen[a * n + b] || !boatable(a, b)) continue
      if (blocked({ x: g.x0 + a * CELL, z: g.z0 + b * CELL })) continue
      seen[a * n + b] = 1
      todo.push([a, b])
    }
  }
  return false
}

/** Past the offshore current's start: open sea all round the island. */
const openSea = (p: P2) => seaward(coast, p.x, p.z) > 330

describe('island coastline', () => {
  it('keeps the city inland and puts open sea on every side', () => {
    expect(seaward(coast, 0, 0)).toBeLessThan(-300)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      // Straight out from the island's middle to the grid's edge: deep water there.
      const x = -700 + Math.cos(a) * 3000
      const z = Math.sin(a) * 3000
      const edge = {
        x: Math.min(g.x0 + g.nx * CELL - 8, Math.max(g.x0 + 8, x)),
        z: Math.min(g.z0 + g.nz * CELL - 8, Math.max(g.z0 + 8, z)),
      }
      expect(heightAt(land, edge.x, edge.z), `edge toward ${a.toFixed(2)}`).toBeLessThan(-8)
    }
  })

  it('has sandy beaches facing at least three ways, and at least two rocky headlands', () => {
    const line = coast.line
    const faces = new Set<string>()
    let rocky = 0
    let inRock = false
    for (let i = 1; i < line.length; i += 3) {
      const p = line[i]
      const sand = sandAt(coast, p.x, p.z)
      // Which way the sea lies: toward the larger distance to the coast.
      const east = seaward(coast, p.x + 20, p.z) - seaward(coast, p.x - 20, p.z)
      const south = seaward(coast, p.x, p.z + 20) - seaward(coast, p.x, p.z - 20)
      if (sand > 0.9) {
        faces.add(Math.abs(east) > Math.abs(south) ? (east > 0 ? 'E' : 'W') : south > 0 ? 'S' : 'N')
      }
      if (sand < 0.05 && !inRock) rocky++
      inRock = sand < 0.05
    }
    expect(faces.size).toBeGreaterThanOrEqual(3)
    expect(rocky).toBeGreaterThanOrEqual(2)
  })
})

describe('waterways', () => {
  const { canal } = land
  const mid = (canal.x0 + canal.x1) / 2

  it('lets a boat out of the canal to open sea at both ends', () => {
    // The middle of the canal is closed off, so each end must find its own way out.
    const middle = (p: P2) => Math.abs(p.z) < 100
    expect(sail({ x: mid, z: canal.z0 + 40 }, openSea, middle)).toBe(true)
    expect(sail({ x: mid, z: canal.z1 - 40 }, openSea, middle)).toBe(true)
  })

  it('leaves room for a boat under every bridge over the canal and its mouths', () => {
    // The humped streets: deck underside over still water.
    expect(HUMP.top - DECK - SEA_LEVEL).toBeGreaterThan(2.2)
    expect(roadRise(land, mid, land.zRoads[3])).toBeCloseTo(HUMP.top)
    // The highway where it crosses each walled channel.
    const hw = land.paths.find((p) => p.name === 'highway')!
    for (const q of land.waterways.channels.quays) {
      const c = { x: (q.x0 + q.x1) / 2, z: (q.z0 + q.z1) / 2 }
      const at = closest(hw.pts, c)
      if (at.at.x < q.x0 || at.at.x > q.x1 || at.at.z < q.z0 || at.at.z > q.z1) continue
      // Deck surface less its 1.3 m depth, over the water.
      expect(hw.pts[at.i].y - 1.3 - SEA_LEVEL).toBeGreaterThan(4)
    }
  })

  it('runs the river from its valley head to the sea, and the branch canal too', () => {
    const r = land.waterways.river
    expect(seaward(coast, r.pts[0].x, r.pts[0].z)).toBeLessThan(-300)
    expect(sail(r.pts[2], openSea)).toBe(true)
    const branch = land.waterways.channels.quays[2]
    expect(sail({ x: (branch.x0 + branch.x1) / 2, z: (branch.z0 + branch.z1) / 2 }, openSea)).toBe(
      true,
    )
  })

  it('stands every road outside the city on land or on a bridge, never in the water', () => {
    for (const p of land.paths) {
      for (const q of p.pts) {
        const lift = q.y - heightAt(land, q.x, q.z)
        expect(lift, `${p.name} buried`).toBeGreaterThan(-0.45)
        if (waterSurfaceAt(land, q.x, q.z) !== null) {
          expect(lift, `${p.name} in the water`).toBeGreaterThan(DECK_FROM)
        }
      }
    }
  })
})
