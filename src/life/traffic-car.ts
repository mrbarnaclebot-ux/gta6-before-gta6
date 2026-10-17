import * as THREE from 'three'
import { easeAngle } from '../camera/orbit-math'
import { damageAt, hurt, type Health } from '../combat/damage'
import type { Surface } from '../combat/effects'
import { RAPIER, TRAFFIC_GROUPS, type PhysicsWorld } from '../physics'
import type { CarVisual } from '../vehicle/car-model'
import { CAR_SPECS } from '../vehicle/car-specs'
import { corners, restOnCorners } from '../land/footing'
import { CAR_HALF } from '../city/parking'
import { CRUISE, type Driver, type Start, type Waypoint } from './lanes'
import { BRAKE } from './stopping'

const HP = 160
const ACCEL = 3
const EULER = new THREE.Euler()
// Light bar flashes per second, alternating red and blue.
const FLASH_RATE = 3

/**
 * An AI car on rails: a kinematic body that follows lane waypoints, slows for
 * turns and for whatever is ahead. Kinematic, so it shoves the player's car
 * aside like a real one would, but never gets knocked off its route.
 */
export class TrafficCar {
  readonly health: Health = { hp: HP, max: HP }
  readonly body: InstanceType<typeof RAPIER.RigidBody>
  readonly collider: InstanceType<typeof RAPIER.Collider>
  readonly position = new THREE.Vector3()
  readonly quaternion = new THREE.Quaternion()
  speed = 0
  heading = 0
  braking = false
  /** Stopped by a carjacking in progress: the driver waits, door about to open. */
  held = false
  /** Set by the traffic manager: called on the first bullet since this car was placed. */
  onShot: () => void = () => {}
  private path: Waypoint[] = []
  private driver: Driver = { next: () => [] }
  private clock = 0
  /** Nose-up angle on bridges and ramps, eased. */
  private pitch = 0
  /** The grade of the current path step, which `pitch` eases toward. */
  private slope = 0
  /** Right-side-down tilt from the road under the wheels, eased like the pitch. */
  private roll = 0
  /** Where the body stands: the lane position lifted or lowered onto the ground under the wheels. */
  readonly feet = new THREE.Vector3()
  /**
   * Height of the solid ground under (x, z), looking down from just above `y`, or null.
   * Set by the traffic manager; lanes give heights, but the road (a deck, a crowned
   * street, a ramp's edge) is what the wheels stand on.
   */
  ground: (x: number, y: number, z: number) => number | null = () => null

  constructor(
    physics: PhysicsWorld,
    readonly visual: CarVisual,
  ) {
    const size = visual.bounds.getSize(new THREE.Vector3())
    const center = visual.bounds.getCenter(new THREE.Vector3())
    this.body = physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
    const shape = RAPIER.ColliderDesc.cuboid(size.x * 0.43, size.y * 0.4, size.z / 2)
      .setTranslation(center.x, size.y * 0.5, center.z)
      .setCollisionGroups(TRAFFIC_GROUPS)
    this.collider = physics.createCollider(shape, this.body)
    // Parked at the origin until first placed; nothing should bump into it there.
    this.collider.setEnabled(false)
  }

  get dead(): boolean {
    return this.health.hp <= 0
  }

  /** Start fresh at a lane position. */
  place(s: Start): void {
    this.driver = s.driver
    this.path = []
    this.health.hp = HP
    this.collider.setEnabled(true)
    this.position.set(s.x, s.y, s.z)
    this.heading = s.yaw
    this.pitch = this.slope = this.roll = 0
    this.speed = CRUISE * 0.7
    this.refill()
    this.settle(1)
    this.pose()
    this.body.setTranslation(this.feet, true)
    this.body.setRotation(this.quaternion, true)
  }

  hit(distance: number): Surface {
    if (this.dead) return 'metal'
    // One vandalism per car: every bullet already counts as gunfire.
    if (this.health.hp === HP) this.onShot()
    hurt(this.health, damageAt(distance))
    return 'metal'
  }

  /** Where engine smoke rises: the middle of the hood, in world space. */
  hood(out: THREE.Vector3): THREE.Vector3 {
    const b = this.visual.bounds
    out.set(0, b.max.y * 0.75, b.max.z * 0.65)
    return out.applyQuaternion(this.quaternion).add(this.feet)
  }

  /**
   * `limit`: the fastest the driver may go given what is ahead. `night` lights the lamps.
   * `siren`: police cars flash their light bar (the player is wanted).
   */
  update(dt: number, limit: number, night: number, siren = false): void {
    const target = this.dead ? 0 : Math.min(limit, this.curveLimit())
    const before = this.speed
    const rate = target > this.speed ? ACCEL : BRAKE
    this.speed += Math.max(-rate * dt, Math.min(rate * dt, target - this.speed))
    this.braking = this.speed < before - 1e-3 || (this.speed < 0.1 && !this.dead)
    const yaw = this.drive(this.speed * dt)
    if (this.path.length) this.heading = easeAngle(this.heading, yaw, 1 - Math.exp(-6 * dt))
    this.settle(1 - Math.exp(-13 * dt))
    this.refill()
    this.pose()
    this.body.setNextKinematicTranslation(this.feet)
    this.body.setNextKinematicRotation(this.quaternion)
    this.lights(dt, night, siren)
  }

  /** Slow down in time for the next turn: v^2 = v_turn^2 + 2 a d. */
  private curveLimit(): number {
    if (!this.path.length) return CRUISE
    let limit = Infinity
    let d = 0
    let from: { x: number; z: number } = this.position
    for (const p of this.path) {
      d += Math.hypot(p.x - from.x, p.z - from.z)
      if (d > 40) break
      limit = Math.min(limit, Math.sqrt(p.limit ** 2 + 2 * BRAKE * 0.6 * Math.max(0, d - 4)))
      from = p
    }
    return limit
  }

  /** Advance `step` meters along the waypoints. Returns the yaw toward the next one. */
  private drive(step: number): number {
    while (this.path.length) {
      const p = this.path[0]
      const dx = p.x - this.position.x
      const dz = p.z - this.position.z
      const d = Math.hypot(dx, dz)
      const dy = (p.y ?? 0) - this.position.y
      if (d > step) {
        this.position.x += (dx / d) * step
        this.position.z += (dz / d) * step
        this.position.y += (dy / d) * step
        this.slope = Math.atan2(dy, d)
        return Math.atan2(dx, dz)
      }
      this.position.set(p.x, p.y ?? 0, p.z)
      step -= d
      this.path.shift()
    }
    return this.heading
  }

  /** Rests the body on the ground found under its four corners, easing its tilt. */
  private settle(k: number): void {
    const { x, y, z } = this.position
    const feet = corners(x, z, this.heading, CAR_HALF.l, CAR_HALF.w)
    let found = false
    const h = feet.map((c) => {
      const g = this.ground(c.x, y, c.z)
      if (g !== null) found = true
      return g ?? y
    })
    const rest = restOnCorners(h, CAR_HALF.l, CAR_HALF.w)
    this.feet.set(x, found ? rest.y : y, z)
    this.pitch += ((found ? rest.pitch : this.slope) - this.pitch) * k
    this.roll += ((found ? rest.roll : 0) - this.roll) * k
  }

  private refill(): void {
    while (this.path.length < 10) {
      const leg = this.driver.next()
      if (!leg.length) return
      this.path.push(...leg)
    }
  }

  private pose(): void {
    this.quaternion.setFromEuler(EULER.set(-this.pitch, this.heading, this.roll, 'YXZ'))
    this.visual.root.position.copy(this.feet)
    this.visual.root.quaternion.copy(this.quaternion)
  }

  private lights(dt: number, night: number, siren: boolean): void {
    const { wheels, lamps, police } = this.visual
    const spin = (this.speed * dt) / CAR_SPECS[this.visual.kind].wheel.radius
    for (const w of wheels) w.rotation.x += spin
    lamps.x = this.dead ? 0 : 6 * night
    lamps.y = this.dead ? 0 : this.braking ? 14 : 1.5 * night
    this.clock += dt
    const flash = Math.floor(this.clock * FLASH_RATE * 2) % 2 ? 1 : -1
    lamps.z = police && siren && !this.dead ? 3 * flash : 0
  }
}
