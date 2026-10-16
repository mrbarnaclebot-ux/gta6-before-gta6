import type { RAPIER } from '../physics'
import { MASS } from './hull'

/** Where a boat is tied up: its spot and heading. */
export interface Mooring {
  x: number
  z: number
  yaw: number
}

// Lines are slack: the boat bobs and sways a little, but the swell never carries it off.
const PULL = MASS * 0.6
const HOLD = MASS * 1.5
const TURN = 9000
const STEADY = 7000

/** Mooring lines as springs: pull back toward the spot and the heading, horizontally only. */
export function mooring(body: InstanceType<typeof RAPIER.RigidBody>, m: Mooring, dt: number): void {
  const t = body.translation()
  const v = body.linvel()
  const r = body.rotation()
  const fx = -PULL * (t.x - m.x) - HOLD * v.x
  const fz = -PULL * (t.z - m.z) - HOLD * v.z
  body.applyImpulse({ x: fx * dt, y: 0, z: fz * dt }, true)
  // Heading from the quaternion's yaw: atan2 of the rotated +z on the ground.
  const yaw = Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.x * r.x + r.y * r.y))
  const off = Math.atan2(Math.sin(yaw - m.yaw), Math.cos(yaw - m.yaw))
  const ty = -TURN * off - STEADY * body.angvel().y
  body.applyTorqueImpulse({ x: 0, y: ty * dt, z: 0 }, true)
}
