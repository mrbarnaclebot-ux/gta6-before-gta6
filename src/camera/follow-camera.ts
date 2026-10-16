import * as THREE from 'three'
import { CAMERA_PROBE_GROUPS, RAPIER, type PhysicsWorld } from '../physics'
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
  foot: { height: 1.55, distance: 4.6, shoulder: 0 },
  car: { height: 1.35, distance: 7.2, shoulder: 0 },
  // Higher and farther back: the hull is longer, and the wake behind it is the show.
  boat: { height: 2.3, distance: 10.5, shoulder: 0 },
  // Gun raised for hip fire: over the shoulder so the crosshair clears the head, no zoom.
  ready: { height: 1.55, distance: 3.6, shoulder: 0.62 },
  // Over the right shoulder, close in, so the crosshair clears the body.
  aim: { height: 1.55, distance: 2.5, shoulder: 0.72 },
}
const AIM_ZOOM = 13
const AIM_RATE = 10

/** Something to chase: its facing (yaw 0 is +Z), forward speed in m/s, and whether it is a boat. */
export interface ChaseTarget {
  heading: number
  speed: number
  boat?: boolean
}

/** Third-person orbit camera that sweeps a sphere toward its ideal spot so walls never clip the view. */
export class FollowCamera {
  yaw = 0
  pitch = 0.18
  /** Mouse look speed multiplier from the settings menu. */
  sensitivity = 1
  invertY = false
  /** Field of view on foot, in degrees (the Display setting). */
  baseFov = 55
  /** 0 to 1: how far the camera has eased into the aiming rig. */
  get aim(): number {
    return this.aimBlend
  }

  /** Over-the-shoulder aim on foot; eases in and out. */
  aiming = false
  /** Gun raised without aiming (hip fire): the shoulder offset without the zoom. */
  raised = false
  private aimBlend = 0
  private readyBlend = 0
  private readonly focus = new THREE.Vector3()
  /** The collider (and its body) the wall probe looks through: the player's capsule or the driven car. */
  ignore: Collider
  private distance = RIGS.foot.distance
  private idle = 0
  /** A fixed camera for filming (the trailer script): while set, the orbit and chase are skipped. */
  shot: { eye: THREE.Vector3; target: THREE.Vector3; fov: number } | null = null
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
    if (this.shot) return this.film(this.shot)
    const k = Math.min(1, dt * AIM_RATE)
    const aim = (this.aimBlend += (Number(this.aiming && !chase) - this.aimBlend) * k)
    const ready = (this.readyBlend +=
      (Number((this.aiming || this.raised) && !chase) - this.readyBlend) * k)
    // Finer mouse while zoomed in, as a scope would be.
    const sens = SENSITIVITY * this.sensitivity * (1 - 0.4 * aim)
    this.yaw -= look.x * sens
    this.pitch = clampPitch(this.pitch + look.y * sens * (this.invertY ? -1 : 1))
    this.idle = look.x || look.y ? 0 : this.idle + dt
    if (chase) this.recenter(chase, dt)
    const rig = chase
      ? chase.boat
        ? RIGS.boat
        : RIGS.car
      : mixRig(mixRig(RIGS.foot, RIGS.ready, ready), RIGS.aim, aim)
    this.focus.copy(focus)
    this.place(focus, rig)
    this.distance = nextDistance(this.distance, this.clearance(rig.distance), dt)
    this.camera.position.copy(this.pivot).addScaledVector(this.dir, this.distance)
    this.camera.lookAt(this.pivot)
    const fov = chaseFov(chase?.speed ?? 0, this.baseFov) - AIM_ZOOM * aim
    if (Math.abs(fov - this.camera.fov) < 0.01) return
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3)
    this.camera.updateProjectionMatrix()
  }

  private film({ eye, target, fov }: NonNullable<FollowCamera['shot']>): void {
    this.camera.position.copy(eye)
    this.camera.lookAt(target)
    if (this.camera.fov === fov) return
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()
  }

  /** Orbit pivot above the focus, shifted toward the camera's right by the rig's shoulder offset. */
  private place(focus: THREE.Vector3, rig: { height: number; shoulder: number }): void {
    const right = rig.shoulder
    this.pivot.set(
      focus.x + Math.cos(this.yaw) * right,
      focus.y + rig.height,
      focus.z - Math.sin(this.yaw) * right,
    )
    this.dir.fromArray(orbitDirection(this.yaw, this.pitch))
  }

  /**
   * Turn so the screen center looks straight at `target` (tests and debugging).
   * Solved for the gun-raised rig, since the camera moves there as soon as one fires.
   * The camera sits off the pivot, so a few fixed-point passes settle the angles.
   */
  aimAt(target: THREE.Vector3): void {
    const rig = this.aiming ? RIGS.aim : RIGS.ready
    for (let i = 0; i < 6; i++) {
      this.place(this.focus, rig)
      const eye = this.pivot.clone().addScaledVector(this.dir, this.distance)
      const to = target.clone().sub(eye).normalize()
      this.yaw = Math.atan2(-to.x, -to.z)
      this.pitch = clampPitch(Math.asin(-to.y))
    }
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
      CAMERA_PROBE_GROUPS,
      this.ignore,
      // The whole vehicle: a boat's windshield is a second collider on the same body.
      this.ignore.parent() ?? undefined,
    )
    return hit ? Math.max(MIN_DISTANCE, hit.time_of_impact) : max
  }
}

type Rig = (typeof RIGS)['foot']

function mixRig(a: Rig, b: Rig, t: number): Rig {
  const mix = (k: keyof typeof a) => a[k] + (b[k] - a[k]) * t
  return { height: mix('height'), distance: mix('distance'), shoulder: mix('shoulder') }
}
