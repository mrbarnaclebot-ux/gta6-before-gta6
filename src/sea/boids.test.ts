import { describe, expect, it } from 'vitest'
import { rng } from '../city/rng'
import { makeSchool, stepSchool, type BoidWorld, type School } from './boids'

const world = (threat: BoidWorld['threat'] = null): BoidWorld => ({
  floor: (x) => -6 + x * 0.05,
  surface: 0,
  threat,
})

const center = (s: School) => {
  let x = 0,
    y = 0,
    z = 0
  for (let i = 0; i < s.n; i++) {
    x += s.pos[i * 3]
    y += s.pos[i * 3 + 1]
    z += s.pos[i * 3 + 2]
  }
  return { x: x / s.n, y: y / s.n, z: z / s.n }
}

/** 1 when every fish heads the same way, near 0 when they scatter. */
const polarization = (s: School) => {
  let x = 0,
    y = 0,
    z = 0
  for (let i = 0; i < s.n; i++) {
    const v = s.vel.subarray(i * 3, i * 3 + 3)
    const l = Math.hypot(v[0], v[1], v[2])
    x += v[0] / l
    y += v[1] / l
    z += v[2] / l
  }
  return Math.hypot(x, y, z) / s.n
}

const run = (s: School, w: BoidWorld, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 30) stepSchool(s, w, 1 / 30)
}

describe('stepSchool', () => {
  it('keeps the school together, heading one way, near home, and off the seabed', () => {
    const s = makeSchool(30, { x: 0, y: -3, z: 0 }, rng(3))
    run(s, world(), 40)
    const c = center(s)
    expect(Math.hypot(c.x, c.z)).toBeLessThan(s.range * 1.5)
    expect(polarization(s)).toBeGreaterThan(0.6)
    for (let i = 0; i < s.n; i++) {
      const [x, y, z] = s.pos.subarray(i * 3, i * 3 + 3)
      expect(y).toBeGreaterThan(world().floor(x, z))
      expect(y).toBeLessThan(0.2)
      expect(Math.hypot(x - c.x, z - c.z)).toBeLessThan(6)
    }
  })

  it('scatters away from a swimmer and then regroups', () => {
    const s = makeSchool(30, { x: 0, y: -3, z: 0 }, rng(5))
    run(s, world(), 10)
    const c = center(s)
    const threat = { ...c }
    const before = Math.min(...Array.from({ length: s.n }, (_, i) => dist(s, i, threat)))
    run(s, world(threat), 1.5)
    const after = Math.min(...Array.from({ length: s.n }, (_, i) => dist(s, i, threat)))
    expect(s.panic).toBeGreaterThan(0.5)
    expect(after).toBeGreaterThan(before + 1)
    run(s, world(), 15)
    expect(s.panic).toBe(0)
    expect(polarization(s)).toBeGreaterThan(0.5)
  })
})

function dist(s: School, i: number, p: { x: number; y: number; z: number }) {
  return Math.hypot(s.pos[i * 3] - p.x, s.pos[i * 3 + 1] - p.y, s.pos[i * 3 + 2] - p.z)
}
