import * as THREE from 'three'
import { ParticlePool } from '../combat/particles'
import { smokeTexture } from '../combat/textures'
import type { Boat } from './boat'
import { planing } from './hull'

/** Where the bow sheets leave the hull (each chine), and where the propeller churns. */
const BOW = [new THREE.Vector3(0.9, -0.15, 1.9), new THREE.Vector3(-0.9, -0.15, 1.9)]
const PROP = new THREE.Vector3(0, -0.2, -3.6)

/** What colors the spray: the sun's color (dim and warm at dusk) and the share of daylight. */
export interface SprayLight {
  sunColor: THREE.Color
  day: number
}

/** Spray off the driven boat: fine droplets in sheets from the bow, a few kicked up by the prop. */
export class Spray {
  readonly points: THREE.Points
  private readonly pool = new ParticlePool(600, smokeTexture(), false)
  /** Particles owed from earlier frames, so slow frames still emit the right number. */
  private owed = { bow: 0, prop: 0 }
  /** Seconds since the last boat drove: past a droplet's life the pool has nothing to move. */
  private idle = Infinity
  private readonly at = new THREE.Vector3()
  private readonly vel = new THREE.Vector3()
  private readonly fwd = new THREE.Vector3()
  private readonly tint = new THREE.Color()

  constructor() {
    this.points = this.pool.points
  }

  update(dt: number, boat: Boat | null, light: SprayLight, viewHeight: number): void {
    this.idle = boat ? 0 : this.idle + dt
    this.points.visible = this.idle < 2
    if (!this.points.visible) return
    if (boat) this.emit(boat, dt, light)
    this.pool.update(dt, viewHeight)
  }

  private emit(boat: Boat, dt: number, light: SprayLight): void {
    const speed = Math.abs(boat.speed)
    const plane = planing(speed)
    // Sunlit droplets plus a little sky; the particles are unlit, so this is their whole light.
    this.tint.copy(light.sunColor).multiplyScalar(0.7)
    this.tint.r += 0.08 + 0.2 * light.day
    this.tint.g += 0.1 + 0.22 * light.day
    this.tint.b += 0.12 + 0.25 * light.day
    this.fwd.set(0, 0, 1).applyQuaternion(boat.quaternion)
    this.owed.bow += (speed > 3 ? 80 + 320 * plane : 0) * dt
    for (; this.owed.bow >= 1; this.owed.bow--) this.bowDrop(boat, speed, plane)
    this.owed.prop += (speed > 1 ? 60 * Math.min(1, speed / 8) : 0) * dt
    for (; this.owed.prop >= 1; this.owed.prop--) this.propDrop(boat, speed)
  }

  /** A droplet thrown up and out from one chine, carried forward at part of the boat's speed. */
  private bowDrop(boat: Boat, speed: number, plane: number): void {
    const b = BOW[Math.random() < 0.5 ? 0 : 1]
    const at = this.at.copy(b).applyQuaternion(boat.quaternion).add(boat.position)
    const out = (1 + 0.12 * speed) * (0.6 + Math.random() * 0.6)
    const up = (0.8 + 0.22 * speed * (0.3 + plane)) * (0.5 + Math.random() * 0.7)
    const vel = this.vel.set(Math.sign(b.x) * out, up, 0).applyQuaternion(boat.quaternion)
    vel.addScaledVector(this.fwd, speed * (0.45 + Math.random() * 0.2))
    const life = 0.5 + Math.random() * 0.3
    this.pool.spawn({
      at,
      vel,
      color: this.tint,
      life,
      size: [0.1, 0.6],
      alpha: 0.6,
      lift: -9.8,
      drag: 0.5,
    })
  }

  /** Droplets thrown up off the white water behind the propeller. */
  private propDrop(boat: Boat, speed: number): void {
    const at = this.at.copy(PROP).applyQuaternion(boat.quaternion).add(boat.position)
    const r = () => Math.random() - 0.5
    const vel = this.vel.set(r() * 2, 1 + Math.random() * 1.5, r() * 2)
    vel.addScaledVector(this.fwd, speed * 0.5)
    this.pool.spawn({
      at,
      vel,
      color: this.tint,
      life: 0.9,
      size: [0.3, 1.4],
      alpha: 0.28,
      lift: -1.5,
      drag: 0.9,
    })
  }
}
