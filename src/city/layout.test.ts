import { describe, expect, it } from 'vitest'
import { generateCity, type Building, type Rect } from './layout'
import { area, contains, overlaps, rectInside, rectMinus } from './polygon'
import { poolsOf, poolWaterAt, POOL_WATER } from './pools'
import { closest, length } from '../land/polyline'
import { SECTION } from './streets'

const city = generateCity(7, 1000)
const buildings = city.blocks.flatMap((b) => b.buildings)
const ground = buildings.filter((b) => b.base === 0)

const footprint = (b: Building): Rect => ({
  x0: b.x - b.w / 2,
  x1: b.x + b.w / 2,
  z0: b.z - b.d / 2,
  z1: b.z + b.d / 2,
})
const corners = (r: Rect) => [
  { x: r.x0, z: r.z0 },
  { x: r.x1, z: r.z0 },
  { x: r.x1, z: r.z1 },
  { x: r.x0, z: r.z1 },
]

describe('generateCity', () => {
  it('is deterministic for a seed and different across seeds', () => {
    expect(generateCity(7, 1000)).toEqual(city)
    expect(generateCity(8, 1000).blocks).not.toEqual(city.blocks)
  })

  it('builds a believable amount of city', () => {
    expect(ground.length).toBeGreaterThan(250)
    expect(Math.max(...buildings.map((b) => b.floors))).toBeGreaterThan(40)
    expect(buildings.some((b) => b.base > 0)).toBe(true)
    expect(city.palms.length).toBeGreaterThan(400)
    expect(city.lights.length).toBeGreaterThan(150)
    expect(city.medians.length).toBeGreaterThan(10)
    expect(city.blocks.some((b) => b.parking.length)).toBe(true)
  })

  it('breaks the grid: a diagonal, a curving coast road, and blocks of many sizes', () => {
    const line = (name: string) => city.net.lines.find((l) => l.name === name)!
    const diag = line('diagonal').pts
    expect(Math.abs(diag[1].x - diag[0].x)).toBeCloseTo(Math.abs(diag[1].z - diag[0].z))
    const xs = line('coast road').pts.map((p) => p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(25)
    const sizes = city.blocks.map((b) => Math.round(area(b.curb) / 500))
    expect(new Set(sizes).size).toBeGreaterThan(10)
  })

  it('keeps every building on its lot, off the canal, and apart from the others', () => {
    for (const block of city.blocks) {
      for (const b of block.buildings) expect(rectInside(footprint(b), block.lot)).toBe(true)
    }
    for (const b of buildings) expect(overlaps(footprint(b), city.canal)).toBe(false)
    for (let i = 0; i < ground.length; i++) {
      for (let j = i + 1; j < ground.length; j++) {
        expect(overlaps(footprint(ground[i]), footprint(ground[j]))).toBe(false)
      }
    }
    // Towers stand on their podiums.
    for (const t of buildings.filter((b) => b.base > 0)) {
      const [a, e] = [footprint(t), 1e-6]
      const on = (g: Building) => {
        const f = footprint(g)
        return a.x0 >= f.x0 - e && a.x1 <= f.x1 + e && a.z0 >= f.z0 - e && a.z1 <= f.z1 + e
      }
      expect(ground.some((g) => g.podium && on(g))).toBe(true)
    }
  })

  it('never puts a building on a road, a sidewalk, or a median', () => {
    const streets = city.net.segments.filter((s) => s.kind !== 'edge')
    for (const b of ground) {
      const pts = corners(footprint(b))
      for (const s of streets) {
        const reach = SECTION[s.kind].half + SECTION[s.kind].walk - 1e-3
        const len = length(s.pts)
        for (const p of pts) {
          // Past a street's end (a T junction) the street across governs instead.
          const c = closest(s.pts, p)
          if (c.s > 1e-6 && c.s < len - 1e-6) expect(c.d).toBeGreaterThan(reach)
        }
      }
      for (const m of city.medians) expect(pts.some((p) => contains(m.ring, p))).toBe(false)
    }
  })

  it('labels each stretch of a curb with the street beyond it', () => {
    for (const b of city.blocks) {
      b.curb.forEach((p, i) => {
        const seg = b.segs[i]
        if (seg < 0) return
        const q = b.curb[(i + 1) % b.curb.length]
        const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }
        const s = city.net.segments[seg]
        expect(b.sides[i]).toBe(s.kind)
        expect(closest(s.pts, mid).d).toBeCloseTo(SECTION[s.kind].half, 1)
      })
    }
  })

  it('never lets two neighbours of one style share a color or come within a floor', () => {
    // NEAR and the palette sizes of massing.ts and world/buildings.ts.
    const palette = { deco: 8, residential: 5, glass: 5 }
    const gap = (a: Building, b: Building) =>
      Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2)
    let pairs = 0
    for (let i = 0; i < ground.length; i++) {
      for (let j = i + 1; j < ground.length; j++) {
        const [a, b] = [ground[i], ground[j]]
        if (a.style !== b.style || gap(a, b) > 6) continue
        pairs++
        const n = palette[a.style]
        expect(a.tint % n, `${a.x},${a.z} and ${b.x},${b.z}`).not.toBe(b.tint % n)
        expect(Math.abs(a.floors - b.floors), `${a.x},${a.z} and ${b.x},${b.z}`).toBeGreaterThan(1)
      }
    }
    expect(pairs).toBeGreaterThan(100)
  })

  it('sinks hotel pools into the decks, cut out of the ground beneath them', () => {
    const pools = poolsOf(city)
    expect(pools.length).toBeGreaterThan(5)
    const size = (r: Rect) => (r.x1 - r.x0) * (r.z1 - r.z0)
    const left = pools.reduce((rs, p) => rs.flatMap((r) => rectMinus(r, p)), [city.land])
    const sum = (rs: Rect[]) => rs.reduce((a, r) => a + size(r), 0)
    expect(sum(left)).toBeCloseTo(size(city.land) - sum(pools), 3)
    for (const p of pools) {
      expect(poolWaterAt(pools, (p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2)).toBe(POOL_WATER)
      expect(left.some((r) => overlaps(r, p))).toBe(false)
    }
  })

  it('never plants a palm or a streetlight inside a building', () => {
    const fps = buildings.map(footprint)
    for (const s of [...city.palms, ...city.lights]) {
      expect(fps.some((f) => s.x > f.x0 && s.x < f.x1 && s.z > f.z0 && s.z < f.z1)).toBe(false)
    }
  })
})
