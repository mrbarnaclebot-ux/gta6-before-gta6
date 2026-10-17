import * as THREE from 'three'
import type { RAPIER } from '../physics'
import {
  bank,
  buoyancy,
  FIN,
  hullDrag,
  HULL_POINTS,
  keelDrag,
  lift,
  MASS,
  PITCH_STIFFNESS,
  ROLL_STIFFNESS,
  RUDDER,
  thrust,
  trim,
} from './hull'
import type { Current } from '../sea/offshore'

type Body = InstanceType<typeof RAPIER.RigidBody>
type WaterQuery = (x: number, z: number) => number | null

/** The outboard's propeller, and the two ends of the keel that resist sliding sideways. */
const PROP = new THREE.Vector3(0, -0.55, -3.3)
const KEEL = [new THREE.Vector3(0, -0.4, 2.2), new THREE.Vector3(0, -0.4, -2.6)]

const q = new THREE.Quaternion()
const at = new THREE.Vector3()
const arm = new THREE.Vector3()
const vel = new THREE.Vector3()
const lin = new THREE.Vector3()
const ang = new THREE.Vector3()
const fwd = new THREE.Vector3()
const side = new THREE.Vector3()
const push = new THREE.Vector3()
const toShore = { x: 0, z: 0 }

/** Applies the water's forces to one hull each fixed step, as impulses (Rapier forces persist). */
export class BoatForces {
  /** The hull's center of mass this step; drag and lift act there. */
  private readonly origin = new THREE.Vector3()

  constructor(
    private readonly body: Body,
    private readonly water: WaterQuery,
    private readonly current: Current,
  ) {}

  /** Returns the forward speed in m/s. */
  apply(dt: number, helm: { throttle: number; steer: number }, dead: boolean): number {
    this.read()
    const speed = lin.dot(fwd)
    const wet = this.float(dt) / HULL_POINTS.length
    if (wet > 0) {
      this.impulse(push.copy(fwd).multiplyScalar(hullDrag(speed) * wet), this.origin, dt)
      for (const k of KEEL) this.keel(k, wet, dt)
      this.impulse(push.set(0, lift(speed) * wet, 0), this.origin, dt)
      this.attitude(speed, helm.steer, wet, dt)
      // Far offshore the sea pushes back harder than the outboard can push out.
      const k = this.current(this.origin.x, this.origin.z, toShore)
      if (k > 0)
        this.impulse(
          push.set(toShore.x, 0, toShore.z).multiplyScalar(MASS * 8 * k * wet),
          this.origin,
          dt,
        )
    }
    this.propel(helm, speed, dead, dt)
    return speed
  }

  private read(): void {
    const t = this.body.worldCom()
    const r = this.body.rotation()
    const v = this.body.linvel()
    const w = this.body.angvel()
    this.origin.set(t.x, t.y, t.z)
    q.set(r.x, r.y, r.z, r.w)
    lin.set(v.x, v.y, v.z)
    ang.set(w.x, w.y, w.z)
    fwd.set(0, 0, 1).applyQuaternion(q)
    side.set(1, 0, 0).applyQuaternion(q)
  }

  /** A hull point's world position (into `at`) and velocity (into `vel`). */
  private point(local: THREE.Vector3 | [number, number, number]): void {
    if (Array.isArray(local)) at.fromArray(local)
    else at.copy(local)
    at.applyQuaternion(q).add(this.origin)
    arm.subVectors(at, this.origin)
    vel.crossVectors(ang, arm).add(lin)
  }

  /** How deep `at` is under the waves; negative above them or on land. */
  private depth(): number {
    const surface = this.water(at.x, at.z)
    return surface === null ? -1 : surface - at.y
  }

  /** Buoyancy at each hull point. Returns how many points are in the water. */
  private float(dt: number): number {
    let wet = 0
    for (const p of HULL_POINTS) {
      this.point(p)
      const d = this.depth()
      if (d <= 0) continue
      wet++
      this.impulse(push.set(0, buoyancy(d, vel.y), 0), at, dt)
    }
    return wet
  }

  private keel(local: THREE.Vector3, wet: number, dt: number): void {
    this.point(local)
    const f = keelDrag(vel.dot(side)) * wet
    this.impulse(push.copy(side).multiplyScalar(f), at, dt)
  }

  /** Bow up over the hump and on the plane; lean into turns. */
  private attitude(speed: number, steer: number, wet: number, dt: number): void {
    const pitch = -PITCH_STIFFNESS * trim(speed) * wet
    const roll = ROLL_STIFFNESS * bank(steer, speed) * wet
    push.copy(side).multiplyScalar(pitch).addScaledVector(fwd, roll).multiplyScalar(dt)
    this.body.applyTorqueImpulse(push, true)
  }

  /** The outboard swings to steer; its lower unit also acts as a rudder at speed. */
  private propel(
    helm: { throttle: number; steer: number },
    speed: number,
    dead: boolean,
    dt: number,
  ) {
    this.point(PROP)
    if (this.depth() <= 0) return
    const t = thrust(helm.throttle, speed, dead)
    const a = helm.steer * RUDDER
    const fin = -helm.steer * FIN * speed * Math.abs(speed)
    push
      .copy(fwd)
      .multiplyScalar(t * Math.cos(a))
      .addScaledVector(side, -t * Math.sin(a) + fin)
    this.impulse(push, at, dt)
  }

  private impulse(force: THREE.Vector3, point: THREE.Vector3, dt: number): void {
    this.body.applyImpulseAtPoint(
      { x: force.x * dt, y: force.y * dt, z: force.z * dt },
      { x: point.x, y: point.y, z: point.z },
      true,
    )
  }
}
