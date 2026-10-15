import { describe, expect, it } from 'vitest'
import { cameraRelative, clampPitch, nextDistance, orbitDirection, PITCH_MAX } from './orbit-math'

describe('orbit math', () => {
  it('clamps pitch', () => {
    expect(clampPitch(10)).toBe(PITCH_MAX)
  })

  it('puts the camera behind the player at yaw 0 so forward is -Z', () => {
    const [x, y, z] = orbitDirection(0, 0)
    expect([x, y, z].map((v) => Math.round(v))).toEqual([0, 0, 1])
    expect(cameraRelative(0, 0, 1).z).toBeCloseTo(-1)
    expect(cameraRelative(0, 1, 0).x).toBeCloseTo(1)
  })

  it('forward always points away from the camera', () => {
    const yaw = 1.1
    const [cx, , cz] = orbitDirection(yaw, 0)
    const f = cameraRelative(yaw, 0, 1)
    expect(f.x * cx + f.z * cz).toBeCloseTo(-1)
  })

  it('snaps in when blocked and eases out when clear', () => {
    expect(nextDistance(5, 2, 0.016)).toBe(2)
    const out = nextDistance(2, 5, 0.016)
    expect(out).toBeGreaterThan(2)
    expect(out).toBeLessThan(5)
  })
})
