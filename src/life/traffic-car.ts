import * as THREE from 'three'
import { easeAngle } from '../camera/orbit-math'
import { damageAt, hurt, type Health } from '../combat/damage'
import type { Surface } from '../combat/effects'
import { ACTOR_GROUPS, RAPIER, type PhysicsWorld } from '../physics'
import type { CarVisual } from '../vehicle/car-model'
import { CAR_SPECS } from '../vehicle/car-specs'
import { CRUISE, type Driver, type Start, type Waypoint } from './lanes'

const HP = 160
const ACCEL = 3
const BRAKE = 7
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
  /** Set by the traffic manager: called on the first bullet since this car was placed. */
  onShot: () => void = () => {}
  private path: Waypoint[] = []
  private driver: Driver = { next: () => [] }
  private clock = 0
  /** Nose-up angle on bridges and ramps, eased. */
  private pitch = 0
  /** The grade of the current path step, which `pitch` eases toward. */
  private slope = 0

  constructor(
    physics: PhysicsWorld,
    readonly visual: CarVisual,
  ) {
    const size = visual.bounds.getSize(new THREE.Vector3())
    const center = visual.bounds.getCenter(new THREE.Vector3())
    this.body = physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
    const shape = RAPIER.ColliderDesc.cuboid(size.x * 0.43, size.y * 0.4, size.z / 2)
      .setTranslation(center.x, size.y * 0.5, center.z)
      .setCollisionGroups(ACTOR_GROUPS)
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
    this.pitch = this.slope = 0
    this.speed = CRUISE * 0.7
    this.refill()
    this.pose()
    this.body.setTranslation(this.position, true)
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
    return out.applyQuaternion(this.quaternion).add(this.position)
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
    this.pitch += (this.slope - this.pitch) * (1 - Math.exp(-13 * dt))
    if (this.path.length) this.heading = easeAngle(this.heading, yaw, 1 - Math.exp(-6 * dt))
    this.refill()
    this.pose()
    this.body.setNextKinematicTranslation(this.position)
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

  private refill(): void {
    while (this.path.length < 10) {
      const leg = this.driver.next()
      if (!leg.length) return
      this.path.push(...leg)
    }
  }

  private pose(): void {
    this.quaternion.setFromEuler(EULER.set(-this.pitch, this.heading, 0, 'YXZ'))
    this.visual.root.position.copy(this.position)
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
