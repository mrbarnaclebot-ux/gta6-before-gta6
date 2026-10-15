import * as THREE from 'three'
import { damageAt, hurt, type Health } from '../combat/damage'
import type { Surface } from '../combat/effects'
import { RAPIER, type PhysicsWorld } from '../physics'
import type { CarVisual } from './car-model'
import { BRAKE, drag, floods, HANDBRAKE, pedals, steerToward } from './drive'

const MASS = 1250
const REST = 0.3
const STIFFNESS = 32
// Static sag: the four springs together hold the car's weight.
const SAG = 9.81 / (4 * STIFFNESS)
const GRIP = 2.4
const DRIFT_GRIP = 1.4
// The cabin floor sits this far above the ground; water deeper than STALL_DEPTH above it floods the engine.
const FLOOR = 0.3
// About ten close pistol shots.
const CAR_HP = 240

export interface Controls {
  throttle: number
  steer: number
  handbrake: boolean
}

type WaterQuery = (x: number, z: number) => number | null

/** A Rapier raycast-vehicle: a dynamic box chassis on four spring rays; the model follows it. */
export class Car {
  readonly body: InstanceType<typeof RAPIER.RigidBody>
  readonly collider: InstanceType<typeof RAPIER.Collider>
  /** Forward speed in m/s; negative while reversing. */
  speed = 0
  stalled = false
  braking = false
  readonly health: Health = { hp: CAR_HP, max: CAR_HP }
  /** Interpolated chassis transform for rendering. */
  readonly position = new THREE.Vector3()
  readonly quaternion = new THREE.Quaternion()
  private readonly vehicle: ReturnType<PhysicsWorld['createVehicleController']>
  private readonly prev = { p: new THREE.Vector3(), q: new THREE.Quaternion() }
  private readonly curr = { p: new THREE.Vector3(), q: new THREE.Quaternion() }
  private steer = 0
  /** Each wheel's spring top in car space; fixed, so read once instead of every frame. */
  private readonly anchorY: number[] = []

  constructor(
    physics: PhysicsWorld,
    readonly visual: CarVisual,
    spot: { x: number; y: number; z: number; yaw: number },
    private readonly water: WaterQuery,
  ) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.yaw)
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spot.x, spot.y, spot.z)
      .setRotation(q)
      .setCanSleep(true)
    this.body = physics.createRigidBody(desc)
    this.collider = physics.createCollider(chassisShape(visual.bounds), this.body)
    this.vehicle = physics.createVehicleController(this.body)
    this.vehicle.indexUpAxis = 1
    this.vehicle.setIndexForwardAxis = 2
    visual.wheels.forEach((w, i) => this.addWheel(w.position, i < 2))
    this.snapshot()
    this.snapshot()
    this.update(1)
  }

  private addWheel(hub: THREE.Vector3, front: boolean): void {
    const v = this.vehicle
    const i = v.numWheels()
    const anchor = { x: hub.x, y: hub.y + REST - SAG, z: hub.z }
    this.anchorY.push(anchor.y)
    v.addWheel(anchor, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, REST, hub.y)
    v.setWheelSuspensionStiffness(i, STIFFNESS)
    v.setWheelSuspensionCompression(i, 2.6)
    v.setWheelSuspensionRelaxation(i, 3.2)
    v.setWheelMaxSuspensionTravel(i, 0.25)
    v.setWheelMaxSuspensionForce(i, MASS * 40)
    v.setWheelFrictionSlip(i, front ? GRIP + 0.2 : GRIP)
  }

  /** One fixed physics step. Null controls means parked: handbrake on, engine off. */
  fixedUpdate(dt: number, controls: Controls | null): void {
    // A parked car at rest costs nothing until something bumps it awake.
    if (!controls && this.body.isSleeping()) return
    const t = this.body.translation()
    const surface = this.water(t.x, t.z)
    const depth = surface === null ? -1 : surface - (t.y + FLOOR)
    this.stalled = floods(this.stalled, depth)
    this.body.setLinearDamping(depth > -FLOOR ? 1.2 : 0)
    this.body.setAngularDamping(depth > -FLOOR ? 1.2 : 0.05)
    this.speed = this.vehicle.currentVehicleSpeed()
    if (controls) this.drive(dt, controls)
    else this.park()
    this.vehicle.updateVehicle(dt)
    this.snapshot()
  }

  /** Flooded or shot to pieces: the engine no longer runs. */
  get dead(): boolean {
    return this.stalled || this.health.hp <= 0
  }

  /** A bullet from `distance` meters away. Pistol rounds do not move a 1.2 t car, so no impulse. */
  hit(distance: number): Surface {
    hurt(this.health, damageAt(distance))
    return 'metal'
  }

  /** Where engine smoke rises: the middle of the hood, in world space. */
  hood(out: THREE.Vector3): THREE.Vector3 {
    const b = this.visual.bounds
    out.set(0, b.max.y * 0.75, b.max.z * 0.65)
    return out.applyQuaternion(this.quaternion).add(this.position)
  }

  private drive(dt: number, c: Controls): void {
    const v = this.vehicle
    const { engine, brake } = pedals(c.throttle, this.speed, this.dead)
    this.braking = brake === BRAKE || c.handbrake
    this.steer = steerToward(this.steer, c.steer, this.speed, dt)
    for (let i = 0; i < 4; i++) {
      const rear = i >= 2
      v.setWheelSteering(i, rear ? 0 : this.steer)
      // Rear-wheel drive; the handbrake locks the rears and lets them slide.
      v.setWheelEngineForce(i, rear ? engine : 0)
      v.setWheelBrake(i, rear && c.handbrake ? HANDBRAKE : brake)
      v.setWheelFrictionSlip(i, rear && c.handbrake ? DRIFT_GRIP : rear ? GRIP : GRIP + 0.2)
    }
    const vel = this.body.linvel()
    const s = Math.hypot(vel.x, vel.y, vel.z)
    if (s > 0.5) {
      const k = (drag(s) * dt) / s
      this.body.applyImpulse({ x: vel.x * k, y: vel.y * k, z: vel.z * k }, true)
    }
  }

  private park(): void {
    this.braking = false
    for (let i = 0; i < 4; i++) {
      this.vehicle.setWheelEngineForce(i, 0)
      this.vehicle.setWheelBrake(i, BRAKE)
    }
  }

  /** Move instantly, at rest, keeping the heading (tests and debugging). */
  place(at: THREE.Vector3): void {
    this.body.setTranslation(at, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
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

  /** Render-rate update: place the model, spin and steer the wheels, light the lamps. */
  update(alpha: number, driven = false): void {
    // A parked car asleep has not moved since it was last posed.
    if (!driven && this.body.isSleeping()) return
    this.position.lerpVectors(this.prev.p, this.curr.p, alpha)
    this.quaternion.slerpQuaternions(this.prev.q, this.curr.q, alpha)
    const { root, wheels, headlights, brakelights } = this.visual
    root.position.copy(this.position)
    root.quaternion.copy(this.quaternion)
    wheels.forEach((w, i) => {
      const travel = this.vehicle.wheelSuspensionLength(i) ?? REST
      w.position.y = this.anchorY[i] - travel
      w.rotation.set(this.vehicle.wheelRotation(i) ?? 0, this.vehicle.wheelSteering(i) ?? 0, 0)
    })
    headlights.emissiveIntensity = driven && !this.dead ? 10 : 0.15
    brakelights.emissiveIntensity = this.braking ? 24 : driven && !this.dead ? 1.5 : 0.3
  }
}

/** A box over the cabin and bumpers, raised clear of the road so only the wheels touch it. */
function chassisShape(b: THREE.Box3) {
  const size = b.getSize(new THREE.Vector3())
  const center = b.getCenter(new THREE.Vector3())
  const bottom = 0.28
  const half = { x: size.x * 0.43, y: (b.max.y - bottom) / 2, z: size.z / 2 }
  const cy = bottom + half.y
  // A low center of mass keeps hard corners from rolling the car.
  const com = { x: 0, y: 0.45, z: center.z }
  const inertia = {
    x: (MASS / 3) * (half.y ** 2 + half.z ** 2),
    y: (MASS / 3) * (half.x ** 2 + half.z ** 2),
    z: (MASS / 3) * (half.x ** 2 + half.y ** 2),
  }
  return RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
    .setTranslation(center.x, cy, center.z)
    .setMassProperties(MASS, com, inertia, { x: 0, y: 0, z: 0, w: 1 })
    .setFriction(0.4)
}
