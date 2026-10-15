import * as THREE from 'three'
import { cameraRelative } from '../camera/orbit-math'
import { moveAxes } from '../input/bindings'
import type { Input } from '../input/input'
import { RAPIER, type PhysicsWorld } from '../physics'
import type { Avatar } from './avatar'
import { animState, fall, RUN_SPEED, steer, turnToward, WALK_SPEED, type Motion } from './movement'

const HALF_HEIGHT = 0.55
const RADIUS = 0.35
const CENTER = HALF_HEIGHT + RADIUS
const KILL_Y = -30

/** Kinematic capsule driven by Rapier's character controller; the avatar follows it. */
export class Player {
  readonly collider: InstanceType<typeof RAPIER.Collider>
  readonly motion: Motion = { vx: 0, vz: 0, vy: 0, airTime: 0 }
  /** Feet position, interpolated between physics steps for smooth rendering. */
  readonly position = new THREE.Vector3()
  private readonly body: InstanceType<typeof RAPIER.RigidBody>
  private readonly controller: InstanceType<typeof RAPIER.KinematicCharacterController>
  private readonly prev = new THREE.Vector3()
  private readonly curr = new THREE.Vector3()
  private heading = Math.PI

  constructor(
    physics: PhysicsWorld,
    readonly avatar: Avatar,
    private readonly spawn: THREE.Vector3,
  ) {
    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    this.body = physics.createRigidBody(desc.setTranslation(spawn.x, spawn.y + CENTER, spawn.z))
    this.collider = physics.createCollider(
      RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS),
      this.body,
    )
    this.controller = physics.createCharacterController(0.02)
    this.controller.enableAutostep(0.45, 0.2, false)
    this.controller.enableSnapToGround(0.35)
    this.controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180)
    this.controller.setMinSlopeSlideAngle((35 * Math.PI) / 180)
    this.controller.setApplyImpulsesToDynamicBodies(true)
    this.curr.copy(spawn)
    this.prev.copy(spawn)
    avatar.root.position.copy(spawn)
  }

  get grounded(): boolean {
    return this.controller.computedGrounded()
  }

  /** One fixed physics step of movement. Call before world.step(). */
  fixedUpdate(dt: number, input: Input, cameraYaw: number): void {
    const m = this.motion
    const axes = moveAxes(input.held)
    const wish = cameraRelative(cameraYaw, axes.x, axes.z)
    const speed = input.held.has('run') ? RUN_SPEED : WALK_SPEED
    steer(m, wish.x * speed, wish.z * speed, dt)
    fall(m, this.grounded, input.consume('jump'), dt)
    const want = { x: m.vx * dt, y: m.vy * dt, z: m.vz * dt }
    this.controller.computeColliderMovement(this.collider, want)
    const moved = this.controller.computedMovement()
    // Bumped a ceiling: stop rising instead of sticking to it.
    if (m.vy > 0 && moved.y < want.y * 0.5) m.vy = 0
    const p = this.body.translation()
    this.prev.copy(this.curr)
    this.curr.set(p.x + moved.x, p.y + moved.y - CENTER, p.z + moved.z)
    if (this.curr.y < KILL_Y) return this.respawn()
    this.body.setNextKinematicTranslation({
      x: this.curr.x,
      y: this.curr.y + CENTER,
      z: this.curr.z,
    })
    if (axes.x || axes.z) this.heading = turnToward(this.heading, Math.atan2(wish.x, wish.z), dt)
  }

  /** Render-rate update: interpolate, face the heading, pick the animation. */
  update(dt: number, alpha: number): void {
    this.position.lerpVectors(this.prev, this.curr, alpha)
    this.avatar.root.position.copy(this.position)
    this.avatar.root.rotation.y = this.heading
    this.avatar.play(animState(this.motion), Math.hypot(this.motion.vx, this.motion.vz))
    this.avatar.update(dt)
  }

  /** Move instantly to a feet position (respawn, tests, later: entering and leaving cars). */
  teleport(feet: THREE.Vector3): void {
    this.curr.copy(feet)
    this.prev.copy(feet)
    Object.assign(this.motion, { vx: 0, vz: 0, vy: 0 })
    this.body.setTranslation({ x: feet.x, y: feet.y + CENTER, z: feet.z }, true)
  }

  private respawn(): void {
    this.teleport(this.spawn)
  }
}
