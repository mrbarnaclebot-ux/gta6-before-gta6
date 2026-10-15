import * as THREE from 'three'
import type { FollowCamera } from '../camera/follow-camera'
import { behind } from '../camera/orbit-math'
import type { Input } from '../input/input'
import { RAPIER, type PhysicsWorld } from '../physics'
import type { Player } from '../player/player'
import { MAX_RANGE } from './damage'
import type { Effects, Surface } from './effects'
import { Gun } from './gun'
import { fire, newPistol, reload, tick } from './weapon'

/** Anything a bullet can hurt: dummies and cars. */
export interface Target {
  hit(distance: number, point: THREE.Vector3): Surface
}

// After a hip-fire shot, keep the gun raised and the body turned this long.
const READY_TIME = 1.2
const CHEST = 1.35

const eye = new THREE.Vector3()
const dir = new THREE.Vector3()
const chest = new THREE.Vector3()
const muzzle = new THREE.Vector3()

/** The pistol in play: aim, fire a hitscan ray from the crosshair, reload. */
export class Shooter {
  readonly pistol = newPistol()
  readonly gun: Gun
  /** Seconds since a bullet last landed on a target, for the HUD hit marker. */
  sinceHit = Infinity
  aiming = false
  /** The crosshair shows while the gun is raised: aiming, or just after a hip-fire shot. */
  raised = false
  shots = 0
  /** The latest shot: from the shooter's chest to where it landed (or 60 m out on a miss). */
  readonly lastShot = { from: new THREE.Vector3(), to: new THREE.Vector3() }
  private sinceShot = Infinity

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly player: Player,
    private readonly follow: FollowCamera,
    private readonly targets: Map<number, Target>,
    private readonly effects: Effects,
  ) {
    this.gun = new Gun(player.avatar.hand)
  }

  /** Render-rate update, after the camera has moved. `armed` is false while driving or swimming. */
  update(dt: number, input: Input, armed: boolean): void {
    tick(this.pistol, dt)
    this.sinceShot += dt
    this.sinceHit += dt
    this.aiming = armed && input.held.has('aim')
    this.raised = armed && (this.aiming || this.sinceShot < READY_TIME)
    this.follow.aiming = this.aiming
    this.gun.visible = armed
    this.player.facing = this.raised ? behind(this.follow.yaw) : null
    const avatar = this.player.avatar
    avatar.aim.on = this.raised
    avatar.aim.elevation = -this.follow.pitch
    if (!armed) {
      // Drop clicks and R presses made in a car, so they do not fire on the way out.
      input.consume('fire')
      return void input.consume('reload')
    }
    if (input.consume('reload') && reload(this.pistol)) avatar.pistol?.reload()
    const reloading = this.pistol.reloading
    // Only take the click once the cooldown allows it, so a fast double-click still fires twice.
    if (this.pistol.cooldown > 0 || !input.consume('fire')) return
    if (!fire(this.pistol)) return
    if (!reloading && this.pistol.reloading) avatar.pistol?.reload()
    this.shoot()
  }

  private shoot(): void {
    this.shots++
    this.sinceShot = 0
    this.player.avatar.pistol?.fire()
    this.effects.muzzle(this.gun.muzzle(muzzle), this.follow.camera.getWorldDirection(dir))
    const camera = this.follow.camera
    camera.getWorldPosition(eye)
    // Start beside the shooter, not at the camera, so nothing behind the player is hit.
    chest.copy(this.player.position).setY(this.player.position.y + CHEST)
    eye.addScaledVector(dir, Math.max(0, chest.sub(eye).dot(dir)))
    const hit = this.physics.castRayAndGetNormal(
      new RAPIER.Ray(eye, dir),
      MAX_RANGE,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      this.player.collider,
    )
    this.lastShot.from.copy(this.player.position)
    this.lastShot.to.copy(eye).addScaledVector(dir, hit ? hit.timeOfImpact : 60)
    if (!hit) return
    const point = eye.clone().addScaledVector(dir, hit.timeOfImpact)
    const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z)
    const target = this.targets.get(hit.collider.handle)
    const distance = point.distanceTo(this.player.position)
    this.effects.impact(point, normal, target ? target.hit(distance, point) : 'world')
    if (target) this.sinceHit = 0
  }
}
