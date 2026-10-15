import * as THREE from 'three'
import { RAPIER, type PhysicsWorld } from '../physics'
import { chaseFov } from '../vehicle/drive'
import { behind, clampPitch, easeAngle, nextDistance, orbitDirection } from './orbit-math'

const SENSITIVITY = 0.0025
const MIN_DISTANCE = 0.8
const PROBE_RADIUS = 0.25
// After this long without mouse input, the chase camera swings back behind the car.
const RECENTER_AFTER = 1.2

type Collider = InstanceType<typeof RAPIER.Collider>

/** Where the orbit centers and how far out it sits: on foot, or chasing a car. */
const RIGS = {
  foot: { height: 1.55, distance: 4.6 },
  car: { height: 1.35, distance: 7.2 },
}

/** Something to chase: its facing (yaw 0 is +Z) and forward speed in m/s. */
export interface ChaseTarget {
  heading: number
  speed: number
}

/** Third-person orbit camera that sweeps a sphere toward its ideal spot so walls never clip the view. */
export class FollowCamera {
  yaw = 0
  pitch = 0.18
  /** The collider the wall probe looks through: the player's capsule or the driven car. */
  ignore: Collider
  private distance = RIGS.foot.distance
  private idle = 0
  private readonly pivot = new THREE.Vector3()
  private readonly dir = new THREE.Vector3()
  private readonly probe = new RAPIER.Ball(PROBE_RADIUS)

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly physics: PhysicsWorld,
    ignore: Collider,
  ) {
    this.ignore = ignore
  }

  update(
    dt: number,
    look: { x: number; y: number },
    focus: THREE.Vector3,
    chase?: ChaseTarget,
  ): void {
    this.yaw -= look.x * SENSITIVITY
    this.pitch = clampPitch(this.pitch + look.y * SENSITIVITY)
    this.idle = look.x || look.y ? 0 : this.idle + dt
    if (chase) this.recenter(chase, dt)
    const rig = chase ? RIGS.car : RIGS.foot
    this.pivot.set(focus.x, focus.y + rig.height, focus.z)
    this.dir.fromArray(orbitDirection(this.yaw, this.pitch))
    this.distance = nextDistance(this.distance, this.clearance(rig.distance), dt)
    this.camera.position.copy(this.pivot).addScaledVector(this.dir, this.distance)
    this.camera.lookAt(this.pivot)
    const fov = chaseFov(chase?.speed ?? 0)
    if (Math.abs(fov - this.camera.fov) < 0.01) return
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3)
    this.camera.updateProjectionMatrix()
  }

  /** Swing behind the car once the mouse rests, faster the faster it goes; a parked car stays put. */
  private recenter(chase: ChaseTarget, dt: number): void {
    if (this.idle < RECENTER_AFTER) return
    const pace = Math.min(1, Math.abs(chase.speed) / 6)
    this.yaw = easeAngle(this.yaw, behind(chase.heading), (1 - Math.exp(-2.5 * dt)) * pace)
    this.pitch += (0.12 - this.pitch) * Math.min(1, dt * 2) * pace
  }

  private clearance(max: number): number {
    const hit = this.physics.castShape(
      this.pivot,
      { x: 0, y: 0, z: 0, w: 1 },
      this.dir,
      this.probe,
      0,
      max,
      true,
      undefined,
      undefined,
      this.ignore,
    )
    return hit ? Math.max(MIN_DISTANCE, hit.time_of_impact) : max
  }
}
