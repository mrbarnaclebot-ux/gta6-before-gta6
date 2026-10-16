import * as THREE from 'three'
import type { Input } from '../input/input'
import type { PhysicsWorld } from '../physics'
import { ACTOR_SHADOW_RANGE, castShadows } from '../render/actor-shadows'
import type { Player, WaterQuery } from '../player/player'
import { Car } from './car'
import type { CarVisual } from './car-model'
import { findExit } from './exit'
import type { Controls, Vehicle } from './vehicle'

/** How close to a car's body or a boat's hull the player must be to get in, meters. */
const ENTER_RANGE = 2
const CAPSULE = { halfHeight: 0.55, radius: 0.35 }
const local = new THREE.Vector3()
const inverse = new THREE.Quaternion()

/** Who is in control: the player on foot, or the player driving a car or a boat. */
export class Driving {
  car: Vehicle | null = null
  /** 0 by day, 1 at night: how hard the headlight throws. Set by the game each frame. */
  night = 0
  /**
   * Parked cars past this many meters are a few pixels across under the haze; not drawing
   * them saves three passes each. Boats are bigger and on open water: twice as far. Set by
   * the render distance.
   */
  drawRange = 150
  /** F with nothing of the player's own in reach: try to pull a driver out instead. */
  steal: () => boolean = () => false
  /** A scripted sequence (a carjacking) moving the player each fixed step; false once done. */
  cutscene: ((dt: number) => boolean) | null = null
  private readonly headlight = new THREE.SpotLight(0xf2f6ff, 0, 70, 0.5, 0.55, 1.6)

  constructor(
    private readonly physics: PhysicsWorld,
    readonly cars: Vehicle[],
    private readonly player: Player,
    scene: THREE.Scene,
    private readonly water: WaterQuery,
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

  /** The closest vehicle the player could get into right now: a boat even from the water. */
  nearest(): Vehicle | null {
    if (this.car || this.cutscene || this.player.dead) return null
    const p = this.player.position
    const swimming = this.player.mode === 'swimming'
    let best: Vehicle | null = null
    let bestD = ENTER_RANGE
    for (const c of this.cars) {
      // A flooded car will not start, so do not offer it.
      if (c.stalled || (swimming && c.kind !== 'boat')) continue
      const d = reach(c, p)
      if (d < bestD && Math.abs(c.position.y - p.y) < 2) [best, bestD] = [c, d]
    }
    return best
  }

  /** Where the driver stands after getting out of `car`. */
  door(car: Vehicle): THREE.Vector3 {
    return findExit(this.physics, car, CAPSULE, this.water)
  }

  /** Move whatever the player controls: the vehicle while driving, otherwise the player. */
  teleport(at: THREE.Vector3, heading?: number): void {
    if (this.car instanceof Car) this.car.place(at, heading)
    else if (this.car) this.car.place(at)
    else this.player.teleport(at)
  }

  /** A traffic car the player has just taken becomes a car like the parked ones. */
  adopt(visual: CarVisual, spot: ConstructorParameters<typeof Car>[2]): Car {
    const car = new Car(this.physics, visual, spot, this.water)
    this.cars.push(car)
    return car
  }

  /** A stolen car leaving play for good: out of the physics world and this list. */
  drop(car: Car): void {
    this.cars.splice(this.cars.indexOf(car), 1)
    car.remove(this.physics)
  }

  fixedUpdate(dt: number, input: Input, cameraYaw: number): void {
    const use = input.consume('use')
    if (this.cutscene) {
      if (!this.cutscene(dt)) this.cutscene = null
    } else if (use && !this.player.dead) this.toggle()
    const controls = this.car ? readControls(input) : null
    for (const c of this.cars) c.fixedUpdate(dt, c === this.car ? controls : null)
    if (!this.car && !this.cutscene) this.player.fixedUpdate(dt, input, cameraYaw)
  }

  /** Step out, if in a vehicle: beside it on dry ground if there is any, else into the water. */
  leave(): void {
    if (!this.car) return
    this.player.teleport(this.door(this.car))
    this.player.collider.setEnabled(true)
    this.car = null
    this.headlight.intensity = 0
  }

  /** Take the wheel of `v`. */
  enter(v: Vehicle): void {
    this.car = v
    this.player.collider.setEnabled(false)
    v.visual.root.add(this.headlight, this.headlight.target)
    this.headlight.position.set(0, 0.75, v.visual.bounds.max.z - 0.1)
    this.headlight.target.position.set(0, 0, 14)
  }

  private toggle(): void {
    if (this.car) return this.leave()
    const near = this.nearest()
    if (near) this.enter(near)
    else this.steal()
  }

  /** Render-rate update: vehicles, and either the walking player or the seated driver. */
  update(dt: number, alpha: number): void {
    const here = this.position
    for (const c of this.cars) {
      c.update(alpha, c === this.car)
      const d = c === this.car ? 0 : c.position.distanceTo(here)
      const boat = c.kind === 'boat'
      c.visual.root.visible = d < (boat ? this.drawRange * 2 : this.drawRange)
      // A boat's shadow on the water is lost in the glitter past a few dozen meters.
      if (boat) castShadows(c.visual.root, d < ACTOR_SHADOW_RANGE * 2)
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

/** Distance on the ground from `p` to the vehicle's footprint, 0 inside it. */
function reach(v: Vehicle, p: THREE.Vector3): number {
  inverse.copy(v.quaternion).invert()
  local.copy(p).sub(v.position).applyQuaternion(inverse)
  const { min, max } = v.visual.bounds
  const dx = Math.max(min.x - local.x, 0, local.x - max.x)
  const dz = Math.max(min.z - local.z, 0, local.z - max.z)
  return Math.hypot(dx, dz)
}

function readControls(input: Input): Controls {
  // Space is the handbrake here; drop its press so leaving the car does not also jump.
  input.consume('jump')
  return input.drive()
}
