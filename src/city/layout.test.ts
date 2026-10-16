import { describe, expect, it } from 'vitest'
import { generateCity, type Building, type Rect } from './layout'

const city = generateCity(7, 1000)
const buildings = city.blocks.flatMap((b) => b.buildings)

const footprint = (b: Building): Rect => ({
  x0: b.x - b.w / 2,
  x1: b.x + b.w / 2,
  z0: b.z - b.d / 2,
  z1: b.z + b.d / 2,
})
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1
const inside = (a: Rect, outer: Rect) =>
  a.x0 >= outer.x0 - 1e-6 &&
  a.x1 <= outer.x1 + 1e-6 &&
  a.z0 >= outer.z0 - 1e-6 &&
  a.z1 <= outer.z1 + 1e-6
const at = (x: number, z: number): Rect => ({ x0: x, x1: x, z0: z, z1: z })

describe('generateCity', () => {
  it('is deterministic for a seed and different across seeds', () => {
    expect(generateCity(7, 1000)).toEqual(city)
    expect(generateCity(8, 1000).blocks).not.toEqual(city.blocks)
  })

  it('builds a believable amount of city', () => {
    expect(buildings.length).toBeGreaterThan(150)
    expect(Math.max(...buildings.map((b) => b.floors))).toBeGreaterThan(30)
    expect(city.palms.length).toBeGreaterThan(200)
    expect(city.lights.length).toBeGreaterThan(200)
  })

  it('keeps every building inside its lot, off the canal, and apart from the others', () => {
    for (const block of city.blocks) {
      for (const b of block.buildings) expect(inside(footprint(b), block.lot)).toBe(true)
    }
    for (const b of buildings) expect(overlaps(footprint(b), city.canal)).toBe(false)
    for (let i = 0; i < buildings.length; i++) {
      for (let j = i + 1; j < buildings.length; j++) {
        expect(overlaps(footprint(buildings[i]), footprint(buildings[j]))).toBe(false)
      }
    }
  })

  it('never plants a palm or a streetlight inside a building', () => {
    const fps = buildings.map(footprint)
    for (const s of [...city.palms, ...city.lights]) {
      expect(fps.some((f) => overlaps(at(s.x, s.z), f))).toBe(false)
    }
  })

  it('grows with size', () => {
    const big = generateCity(7, 2000)
    expect(big.blocks.length).toBeGreaterThan(city.blocks.length * 3)
  })
})
