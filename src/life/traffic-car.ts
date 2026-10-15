import * as THREE from 'three'
import { easeAngle } from '../camera/orbit-math'
import type { CityLayout } from '../city/layout'
import type { Rand } from '../city/rng'
import { damageAt, hurt, type Health } from '../combat/damage'
import type { Surface } from '../combat/effects'
import { ACTOR_GROUPS, RAPIER, type PhysicsWorld } from '../physics'
import type { CarVisual } from '../vehicle/car-model'
import { CRUISE, lanePoint, nextLeg, yawOf, type Heading, type Waypoint } from './lanes'

const HP = 160
const ACCEL = 3
const BRAKE = 7
const WHEEL_RADIUS = 0.36
const UP = new THREE.Vector3(0, 1, 0)

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
  private route: Heading = { axis: 'z', at: 0, dir: 1, u: 0 }

  constructor(
    physics: PhysicsWorld,
    readonly visual: CarVisual,
    private readonly grid: Pick<CityLayout, 'xRoads' | 'zRoads'>,
    private readonly r: Rand,
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
  place(h: Heading): void {
    this.route = h
    this.path = []
    this.health.hp = HP
    this.collider.setEnabled(true)
    const p = lanePoint(h, h.u)
    this.position.set(p.x, 0, p.z)
    this.heading = yawOf(h)
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

  /** `limit`: the fastest the driver may go given what is ahead. `night` lights the lamps. */
  update(dt: number, limit: number, night: number): void {
    const target = this.dead ? 0 : Math.min(limit, this.curveLimit())
    const before = this.speed
    const rate = target > this.speed ? ACCEL : BRAKE
    this.speed += Math.max(-rate * dt, Math.min(rate * dt, target - this.speed))
    this.braking = this.speed < before - 1e-3 || (this.speed < 0.1 && !this.dead)
    const yaw = this.drive(this.speed * dt)
    if (this.path.length) this.heading = easeAngle(this.heading, yaw, 1 - Math.exp(-6 * dt))
    this.refill()
    this.pose()
    this.body.setNextKinematicTranslation(this.position)
    this.body.setNextKinematicRotation(this.quaternion)
    this.lights(dt, night)
  }

  /** Slow down in time for the next turn: v^2 = v_turn^2 + 2 a d. */
  private curveLimit(): number {
    let limit = CRUISE
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
      if (d > step) {
        this.position.x += (dx / d) * step
        this.position.z += (dz / d) * step
        return Math.atan2(dx, dz)
      }
      this.position.set(p.x, 0, p.z)
      step -= d
      this.path.shift()
    }
    return this.heading
  }

  private refill(): void {
    while (this.path.length < 10) {
      const leg = nextLeg(this.grid, this.route, this.r)
      this.path.push(...leg.points)
      this.route = leg.next
    }
  }

  private pose(): void {
    this.quaternion.setFromAxisAngle(UP, this.heading)
    this.visual.root.position.copy(this.position)
    this.visual.root.quaternion.copy(this.quaternion)
  }

  private lights(dt: number, night: number): void {
    const { wheels, headlights, brakelights } = this.visual
    const spin = (this.speed * dt) / WHEEL_RADIUS
    for (const w of wheels) w.rotation.x += spin
    headlights.emissiveIntensity = this.dead ? 0 : 0.15 + 10 * night
    brakelights.emissiveIntensity = this.dead ? 0 : this.braking ? 24 : 0.3 + 1.5 * night
  }
}
