import * as THREE from 'three'
import type { Input } from '../input/input'
import type { PhysicsWorld } from '../physics'
import type { Player } from '../player/player'
import type { Car, Controls } from './car'
import { findExit } from './exit'

const ENTER_RANGE = 3.6
const CAPSULE = { halfHeight: 0.55, radius: 0.35 }

/** Who is in control: the player on foot, or the player driving one of the cars. */
export class Driving {
  car: Car | null = null
  /** 0 by day, 1 at night: how hard the headlight throws. Set by the game each frame. */
  night = 0
  /**
   * Parked cars past this many meters are a few pixels across under the haze; not drawing
   * them saves three passes each. Set by the render distance.
   */
  drawRange = 150
  private readonly headlight = new THREE.SpotLight(0xf2f6ff, 0, 70, 0.5, 0.55, 1.6)

  constructor(
    private readonly physics: PhysicsWorld,
    readonly cars: Car[],
    private readonly player: Player,
    scene: THREE.Scene,
  ) {
    // Always in the scene, dimmed when unused: adding a light later would recompile every shader.
    scene.add(this.headlight, this.headlight.target)
  }

  get mode(): 'driving' | Player['mode'] {
    return this.car ? 'driving' : this.player.mode
  }

  /** What the camera and the sky follow. */
  get position(): THREE.Vector3 {
    return this.car ? this.car.position : this.player.position
  }

  /** The closest car the player could get into right now, if any. */
  nearest(): Car | null {
    if (this.car || this.player.mode !== 'walking') return null
    const p = this.player.position
    let best: Car | null = null
    let bestD = ENTER_RANGE
    for (const c of this.cars) {
      // A flooded car will not start, so do not offer it.
      if (c.stalled) continue
      const d = Math.hypot(c.position.x - p.x, c.position.z - p.z)
      if (d < bestD && Math.abs(c.position.y - p.y) < 2) [best, bestD] = [c, d]
    }
    return best
  }

  /** Where the driver stands after getting out of `car`. */
  door(car: Car): THREE.Vector3 {
    return findExit(this.physics, car, CAPSULE)
  }

  /** Move whatever the player controls: the car while driving, otherwise the player. */
  teleport(at: THREE.Vector3): void {
    if (this.car) this.car.place(at)
    else this.player.teleport(at)
  }

  fixedUpdate(dt: number, input: Input, cameraYaw: number): void {
    if (input.consume('use') && !this.player.dead) this.toggle()
    const controls = this.car ? readControls(input) : null
    for (const c of this.cars) c.fixedUpdate(dt, c === this.car ? controls : null)
    if (!this.car) this.player.fixedUpdate(dt, input, cameraYaw)
  }

  /** Step out of the car, if in one, onto the driver's side. */
  leave(): void {
    if (!this.car) return
    this.player.teleport(this.door(this.car))
    this.player.collider.setEnabled(true)
    this.car = null
    this.headlight.intensity = 0
  }

  private toggle(): void {
    if (this.car) return this.leave()
    this.car = this.nearest()
    if (!this.car) return
    this.player.collider.setEnabled(false)
    this.car.visual.root.add(this.headlight, this.headlight.target)
    this.headlight.position.set(0, 0.75, 2.2)
    this.headlight.target.position.set(0, 0, 14)
  }

  /** Render-rate update: cars, and either the walking player or the seated driver. */
  update(dt: number, alpha: number): void {
    const here = this.position
    for (const c of this.cars) {
      c.update(alpha, c === this.car)
      c.visual.root.visible = c === this.car || c.position.distanceTo(here) < this.drawRange
    }
    if (!this.car) return this.player.update(dt, alpha)
    this.headlight.intensity = this.car.dead ? 0 : 60 + 340 * this.night
    const avatar = this.player.avatar
    avatar.root.quaternion.copy(this.car.quaternion)
    avatar.root.position
      .copy(this.car.visual.seat)
      .applyQuaternion(this.car.quaternion)
      .add(this.car.position)
    avatar.play('drive', 0)
    avatar.update(dt)
  }
}

function readControls(input: Input): Controls {
  const h = input.held
  // Space is the handbrake here; drop its press so leaving the car does not also jump.
  input.consume('jump')
  return {
    throttle: Number(h.has('forward')) - Number(h.has('back')),
    steer: Number(h.has('left')) - Number(h.has('right')),
    handbrake: h.has('jump'),
  }
}
