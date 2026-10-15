import * as THREE from 'three'
import { cameraRelative } from '../camera/orbit-math'
import { moveAxes } from '../input/bindings'
import type { Input } from '../input/input'
import { RAPIER, type PhysicsWorld } from '../physics'
import type { Avatar } from './avatar'
import { findLedge } from './ledge'
import {
  animState,
  fall,
  RUN_SPEED,
  steer,
  turnToward,
  WALK_SPEED,
  type AnimState,
  type Motion,
} from './movement'
import {
  breathe,
  buoyancy,
  FLOAT_DEPTH,
  HEAD_HEIGHT,
  MAX_BREATH,
  MAX_HEALTH,
  nextMode,
  SWIM_SPEED,
  SWIM_SPRINT,
  wadeFactor,
  type Mode,
  type Vitals,
} from './swim'

const HALF_HEIGHT = 0.55
const RADIUS = 0.35
const CENTER = HALF_HEIGHT + RADIUS
const KILL_Y = -30
const SNAP = 0.35
// The swim stroke clip lies flat at hip height; lift it so the back breaks the surface.
const STROKE_LIFT = 0.3
// Divers swim head-down; standing upright on the floor reads as a bind pose from behind.
const DIVE_PITCH = 0.4

/** Water surface height at (x, z), or null where there is no water. */
export type WaterQuery = (x: number, z: number) => number | null

/** Kinematic capsule driven by Rapier's character controller; the avatar follows it. */
export class Player {
  readonly collider: InstanceType<typeof RAPIER.Collider>
  readonly motion: Motion = { vx: 0, vz: 0, vy: 0, airTime: 0 }
  readonly vitals: Vitals = { health: MAX_HEALTH, breath: MAX_BREATH }
  /** Feet position, interpolated between physics steps for smooth rendering. */
  readonly position = new THREE.Vector3()
  mode: Mode = 'walking'
  private readonly body: InstanceType<typeof RAPIER.RigidBody>
  private readonly controller: InstanceType<typeof RAPIER.KinematicCharacterController>
  private readonly prev = new THREE.Vector3()
  private readonly curr = new THREE.Vector3()
  private heading = Math.PI
  private lift = 0
  private pitch = 0
  private diveHeld = false

  constructor(
    private readonly physics: PhysicsWorld,
    readonly avatar: Avatar,
    private readonly spawn: THREE.Vector3,
    private readonly water: WaterQuery,
  ) {
    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    this.body = physics.createRigidBody(desc.setTranslation(spawn.x, spawn.y + CENTER, spawn.z))
    this.collider = physics.createCollider(
      RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS),
      this.body,
    )
    this.controller = physics.createCharacterController(0.02)
    this.controller.enableAutostep(0.45, 0.2, false)
    this.controller.enableSnapToGround(SNAP)
    this.controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180)
    this.controller.setMinSlopeSlideAngle((35 * Math.PI) / 180)
    this.controller.setApplyImpulsesToDynamicBodies(true)
    this.curr.copy(spawn)
    this.prev.copy(spawn)
    avatar.root.position.copy(spawn)
    // Yaw first, then pitch about the body's own side axis.
    avatar.root.rotation.order = 'YXZ'
  }

  get grounded(): boolean {
    return this.controller.computedGrounded()
  }

  /** How far the feet are below the water surface; -Infinity on land. */
  get feetDepth(): number {
    const surface = this.water(this.curr.x, this.curr.z)
    return surface === null ? -Infinity : surface - this.curr.y
  }

  /** One fixed physics step of movement. Call before world.step(). */
  fixedUpdate(dt: number, input: Input, cameraYaw: number): void {
    const depth = this.feetDepth
    this.setMode(nextMode(this.mode, depth))
    const axes = moveAxes(input.held)
    const wish = cameraRelative(cameraYaw, axes.x, axes.z)
    const swimming = this.mode === 'swimming'
    this.diveHeld = swimming && input.held.has('dive')
    const climbed = swimming ? this.swim(dt, input, wish, depth) : this.walk(dt, input, wish, depth)
    if (!climbed) this.move(dt)
    breathe(this.vitals, depth > HEAD_HEIGHT, dt)
    // ponytail: zero health just respawns; real death and a respawn screen arrive in Phase 6.
    if (this.curr.y < KILL_Y || this.vitals.health <= 0) return this.respawn()
    if (axes.x || axes.z) this.heading = turnToward(this.heading, Math.atan2(wish.x, wish.z), dt)
  }

  private walk(dt: number, input: Input, wish: { x: number; z: number }, depth: number): false {
    const speed = (input.held.has('run') ? RUN_SPEED : WALK_SPEED) * wadeFactor(depth)
    steer(this.motion, wish.x * speed, wish.z * speed, dt)
    fall(this.motion, this.grounded, input.consume('jump'), dt)
    return false
  }

  /** Swim one step. Returns true if the swimmer climbed out onto a ledge instead. */
  private swim(dt: number, input: Input, wish: { x: number; z: number }, depth: number): boolean {
    const m = this.motion
    const speed = input.held.has('run') ? SWIM_SPRINT : SWIM_SPEED
    steer(m, wish.x * speed, wish.z * speed, dt)
    m.airTime = 0
    m.vy = buoyancy(m.vy, depth, input.held.has('dive'), input.held.has('jump'), dt)
    // Space at the surface pulls up onto a wall or step ahead; there is no jumping in water.
    if (!input.consume('jump') || depth > FLOAT_DEPTH + 0.3) return false
    const capsule = { halfHeight: HALF_HEIGHT, radius: RADIUS }
    const ledge = findLedge(this.physics, this.collider, this.curr, this.heading, capsule)
    if (ledge) this.teleport(ledge)
    return ledge !== null
  }

  private move(dt: number): void {
    const m = this.motion
    const want = { x: m.vx * dt, y: m.vy * dt, z: m.vz * dt }
    this.controller.computeColliderMovement(this.collider, want)
    const moved = this.controller.computedMovement()
    // Bumped a ceiling: stop rising instead of sticking to it.
    if (m.vy > 0 && moved.y < want.y * 0.5) m.vy = 0
    const p = this.body.translation()
    this.prev.copy(this.curr)
    this.curr.set(p.x + moved.x, p.y + moved.y - CENTER, p.z + moved.z)
    this.body.setNextKinematicTranslation({
      x: this.curr.x,
      y: this.curr.y + CENTER,
      z: this.curr.z,
    })
  }

  /** Floating needs free vertical motion; snapping to the ground would pull a swimmer down. */
  private setMode(mode: Mode): void {
    if (mode === this.mode) return
    this.mode = mode
    if (mode === 'swimming') this.controller.disableSnapToGround()
    else this.controller.enableSnapToGround(SNAP)
  }

  /** Render-rate update: interpolate, face the heading, pick the animation. */
  update(dt: number, alpha: number): void {
    this.position.lerpVectors(this.prev, this.curr, alpha)
    const speed = Math.hypot(this.motion.vx, this.motion.vz)
    const { state, pitch } = this.pose(speed)
    const ease = 1 - Math.exp(-6 * dt)
    this.lift += ((state === 'swim' ? STROKE_LIFT : 0) - this.lift) * ease
    this.pitch += (pitch - this.pitch) * ease
    this.avatar.root.position.copy(this.position).setY(this.position.y + this.lift)
    this.avatar.root.rotation.set(this.pitch, this.heading, 0)
    this.avatar.play(state, speed)
    this.avatar.update(dt)
  }

  /** Below the surface, tread upright only while rising; otherwise swim pitched nose-down. */
  private pose(speed: number): { state: AnimState; pitch: number } {
    if (this.mode !== 'swimming') return { state: animState(this.motion), pitch: 0 }
    const deep = this.feetDepth > FLOAT_DEPTH + 0.5
    const diving = this.diveHeld || (deep && this.motion.vy < 0.3)
    if (diving) return { state: 'swim', pitch: DIVE_PITCH }
    return { state: speed > 0.4 ? 'swim' : 'tread', pitch: 0 }
  }

  /** Move instantly to a feet position (respawn, tests, later: entering and leaving cars). */
  teleport(feet: THREE.Vector3): void {
    this.curr.copy(feet)
    this.prev.copy(feet)
    Object.assign(this.motion, { vx: 0, vz: 0, vy: 0 })
    this.body.setTranslation({ x: feet.x, y: feet.y + CENTER, z: feet.z }, true)
  }

  private respawn(): void {
    Object.assign(this.vitals, { health: MAX_HEALTH, breath: MAX_BREATH })
    this.teleport(this.spawn)
  }
}
