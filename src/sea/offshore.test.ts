import { describe, expect, it } from 'vitest'
import { seaward } from '../land/coast'
import { generateLand } from '../land/plan'
import { hullDrag, MASS, thrust } from '../boat/hull'
import { OFFSHORE, offshoreCurrent, setOnHull } from './offshore'

const land = generateLand(7, 1000)
const current = offshoreCurrent(land.frame.coast)
const coast = land.frame.coast

/** The point straight out from the island's middle at angle `a` where the sea is `d` meters off the coast. */
function out(a: number, d: number) {
  let r = 0
  const at = () => ({ x: -700 + Math.cos(a) * r, z: Math.sin(a) * r })
  while (seaward(coast, at().x, at().z) < d) r += 2
  return at()
}

describe('offshore current', () => {
  it('is still near the coast and full strength well out, all round the island', () => {
    const dir = { x: 0, z: 0 }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const near = out(a, OFFSHORE.from - 20)
      expect(current(near.x, near.z, dir)).toBe(0)
      const far = out(a, OFFSHORE.full + 10)
      expect(current(far.x, far.z, dir)).toBeCloseTo(1)
      // It sets back toward the island: against the way out.
      expect(dir.x * Math.cos(a) + dir.z * Math.sin(a)).toBeLessThan(-0.5)
    }
  })

  it('is at full strength all along the edge of the terrain grid, so no one reaches it', () => {
    const { x0, x1, z0, z1 } = land.frame.grid
    const dir = { x: 0, z: 0 }
    for (let t = 0; t <= 1; t += 1 / 64) {
      const x = x0 + (x1 - x0) * t
      const z = z0 + (z1 - z0) * t
      for (const [px, pz] of [
        [x, z0],
        [x, z1],
        [x0, z],
        [x1, z],
      ])
        expect(current(px, pz, dir)).toBeCloseTo(1)
    }
  })
})

describe('the set on a boat', () => {
  it('slows a boat heading out, then holds full throttle to a slow drift back', () => {
    // One axis, positive toward the island: a 1600 kg hull at full throttle straight out.
    let v = -20
    let slowest = 0
    for (let t = 0; t < 30; t += 1 / 60) {
      const a = setOnHull(1, v)
      expect(a).toBeLessThanOrEqual(8)
      slowest = Math.max(slowest, a)
      v += (a - thrust(1, -v, false) / MASS + hullDrag(-v) / -MASS) / 60
    }
    expect(slowest).toBe(8)
    expect(v).toBeGreaterThan(1.5)
    expect(v).toBeLessThan(3)
    expect(setOnHull(1, 5)).toBe(0)
  })
})
