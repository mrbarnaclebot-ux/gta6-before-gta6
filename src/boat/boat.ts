import * as THREE from 'three'
import { damageAt, hurt, type Health } from '../combat/damage'
import type { Surface } from '../combat/effects'
import { RAPIER, type PhysicsWorld } from '../physics'
import type { Controls, Vehicle } from '../vehicle/vehicle'
import type { BoatVisual } from './boat-model'
import { HULL_BOUNDS } from './boat-model'
import { mooring, type Mooring } from './mooring'
import { BoatForces } from './forces'
import { MASS } from './hull'

const HP = 300
type WaterQuery = (x: number, z: number) => number | null

/**
 * A speedboat: a dynamic Rapier box hull held up by buoyancy sampled at six points against
 * the live waves, pushed by an outboard that only bites while its propeller is underwater,
 * so it beaches on sand instead of driving up it.
 */
export class Boat implements Vehicle {
  readonly kind = 'boat'
  readonly body: InstanceType<typeof RAPIER.RigidBody>
  readonly collider: InstanceType<typeof RAPIER.Collider>
  speed = 0
  stalled = false
  readonly health: Health = { hp: HP, max: HP }
  readonly position = new THREE.Vector3()
  readonly quaternion = new THREE.Quaternion()
  /** Last throttle and rudder, for the wake and spray. */
  readonly helm = { throttle: 0, steer: 0 }
  /** Tied up until someone first drives it; then it floats free where it is left. */
  private moored: Mooring | null
  private readonly forces: BoatForces
  private readonly prev = { p: new THREE.Vector3(), q: new THREE.Quaternion() }
  private readonly curr = { p: new THREE.Vector3(), q: new THREE.Quaternion() }

  constructor(
    physics: PhysicsWorld,
    readonly visual: BoatVisual,
    spot: { x: number; y: number; z: number; yaw: number },
    water: WaterQuery,
  ) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.yaw)
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spot.x, spot.y, spot.z)
      .setRotation(q)
      .setLinearDamping(0.05)
      .setAngularDamping(0.8)
    this.body = physics.createRigidBody(desc)
    this.collider = physics.createCollider(hullShape(), this.body)
    this.forces = new BoatForces(this.body, water)
    this.moored = { ...spot }
    this.snapshot()
    this.snapshot()
    this.update(1)
  }

  get dead(): boolean {
    return this.health.hp <= 0
  }

  /**
   * One fixed step. A boat out of sight with nobody at the helm sleeps: the waves would
   * otherwise cost six samples a step for something nobody sees.
   */
  fixedUpdate(dt: number, controls: Controls | null): void {
    if (!controls && !this.visual.root.visible) {
      if (!this.body.isSleeping()) this.body.sleep()
      return
    }
    if (this.body.isSleeping()) this.body.wakeUp()
    if (controls) this.moored = null
    this.helm.throttle = controls?.throttle ?? 0
    this.helm.steer = controls?.steer ?? 0
    this.speed = this.forces.apply(dt, this.helm, this.dead)
    if (this.moored) mooring(this.body, this.moored, dt)
    this.snapshot()
  }

  /** A bullet from `distance` meters away; enough of them kill the engine. */
  hit(distance: number): Surface {
    hurt(this.health, damageAt(distance))
    return 'metal'
  }

  /** Where engine smoke rises: the outboard's cowling. */
  hood(out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, 1.2, -3.5).applyQuaternion(this.quaternion).add(this.position)
  }

  /** Move instantly, at rest, keeping the heading (tests and debugging). */
  place(at: THREE.Vector3): void {
    this.body.setTranslation(at, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.moored = null
    this.snapshot()
    this.snapshot()
  }

  private snapshot(): void {
    this.prev.p.copy(this.curr.p)
    this.prev.q.copy(this.curr.q)
    const t = this.body.translation()
    const r = this.body.rotation()
    this.curr.p.set(t.x, t.y, t.z)
    this.curr.q.set(r.x, r.y, r.z, r.w)
  }

  update(alpha: number): void {
    this.position.lerpVectors(this.prev.p, this.curr.p, alpha)
    this.quaternion.slerpQuaternions(this.prev.q, this.curr.q, alpha)
    this.visual.root.position.copy(this.position)
    this.visual.root.quaternion.copy(this.quaternion)
  }
}

/** The hull as a box from the keel to the gunwale, its weight low and a little aft. */
function hullShape() {
  const b = HULL_BOUNDS
  const half = b.getSize(new THREE.Vector3()).multiplyScalar(0.5)
  const center = b.getCenter(new THREE.Vector3())
  const inertia = {
    x: (MASS / 3) * (half.y ** 2 + half.z ** 2),
    y: (MASS / 3) * (half.x ** 2 + half.z ** 2),
    z: (MASS / 3) * (half.x ** 2 + half.y ** 2),
  }
  return RAPIER.ColliderDesc.cuboid(half.x * 0.92, half.y, half.z)
    .setTranslation(center.x, center.y, center.z)
    .setMassProperties(MASS, { x: 0, y: -0.1, z: -0.3 }, inertia, { x: 0, y: 0, z: 0, w: 1 })
    .setFriction(0.3)
}
