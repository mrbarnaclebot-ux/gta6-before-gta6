import * as THREE from 'three'
import type { Player } from '../player/player'
import type { Car } from '../vehicle/car'
import type { Driving } from '../vehicle/driving'
import { jackCrime, WITNESS_RANGE } from './carjack-rules'
import type { Crowd } from './crowd'
import type { Pedestrian } from './pedestrian'
import type { Traffic } from './traffic'
import type { TrafficCar } from './traffic-car'
import type { Crime } from './wanted'

/** Seconds from the door opening to the driver standing clear. */
const PULL_TIME = 1.3
/** Give up walking to the door after this long and step there (something in the way). */
const WALK_LIMIT = 3

interface Job {
  car: TrafficCar
  phase: 'walk' | 'pull'
  t: number
  /** World spots: where the player stands, where the driver starts and ends, and which way. */
  door: THREE.Vector3
  seat: THREE.Vector3
  clear: THREE.Vector3
  face: number
  ped: Pedestrian | null
}

const EULER = new THREE.Euler()

/**
 * F beside a stopped traffic car: walk to the driver's door, haul the driver out (they run
 * off), and take the wheel. The AI car becomes an ordinary drivable one.
 */
export class Carjack {
  /** Told when a stolen car changes hands, so bullets can find the new bodies. */
  onSteal: (gone: TrafficCar, stolen: Car, fresh: TrafficCar) => void = () => {}
  private job: Job | null = null

  constructor(
    private readonly traffic: Traffic,
    private readonly crowd: Crowd,
    private readonly driving: Driving,
    private readonly player: Player,
    private readonly report: (crime: Crime) => void,
  ) {
    driving.steal = () => this.start()
  }

  /** Where the sequence is, for the HUD and tests: null when idle. */
  get phase(): Job['phase'] | null {
    return this.job?.phase ?? null
  }

  /** The car F would take right now, if any. */
  target(): TrafficCar | null {
    if (this.job || this.driving.mode !== 'walking') return null
    return this.traffic.jackable(this.player.position)
  }

  private start(): boolean {
    const car = this.target()
    if (!car) return false
    car.held = true
    this.job = { car, phase: 'walk', t: 0, ...spots(car), ped: null }
    this.driving.cutscene = (dt) => this.step(dt)
    return true
  }

  /** One fixed step of the sequence; false once it is over. */
  private step(dt: number): boolean {
    const j = this.job!
    if (this.player.dead) return this.abort(j)
    j.t += dt
    const left = this.player.approach(dt, j.door, j.face)
    if (j.phase === 'walk') {
      if (left < 0.3) return this.pull(j)
      if (j.t > WALK_LIMIT) this.player.teleport(j.door)
      return true
    }
    const k = Math.min(1, j.t / PULL_TIME)
    j.ped!.position.lerpVectors(j.seat, j.clear, k * k * (3 - 2 * k))
    return k < 1 || this.finish(j)
  }

  /** The door opens: a driver appears and is hauled out; anyone near sees it. */
  private pull(j: Job): boolean {
    Object.assign(j, { phase: 'pull', t: 0 })
    this.player.acting = 'pull'
    const at = j.car.position
    const seen = this.crowd.near(at, WITNESS_RANGE) + this.traffic.near(at, WITNESS_RANGE, true)
    const crime = jackCrime(j.car.visual.police, seen)
    if (crime) this.report(crime)
    j.ped = this.crowd.borrow(at)
    j.ped.haul(j.seat, j.face + Math.PI)
    return true
  }

  /** The driver runs; the player gets in; traffic gets a new car to replace this one. */
  private finish(j: Job): false {
    const { car } = j
    j.ped!.run(j.clear.x - j.seat.x, j.clear.z - j.seat.z)
    this.player.acting = null
    EULER.setFromQuaternion(car.quaternion, 'YXZ')
    const { x, y, z } = car.feet
    const spot = { x, y: y + 0.02, z, yaw: EULER.y, pitch: -EULER.x, roll: EULER.z }
    const stolen = this.driving.adopt(car.visual, spot)
    const fresh = this.traffic.release(car)
    this.onSteal(car, stolen, fresh)
    this.driving.enter(stolen)
    this.job = null
    return false
  }

  private abort(j: Job): false {
    j.car.held = false
    j.ped?.run(j.clear.x - j.seat.x, j.clear.z - j.seat.z)
    this.player.acting = null
    this.job = null
    return false
  }
}

/** The door spots in world space, from the car's own box: the driver sits on its +x side. */
function spots(car: TrafficCar) {
  const { bounds, seat } = car.visual
  const world = (x: number, z: number) =>
    new THREE.Vector3(x, 0, z).applyQuaternion(car.quaternion).add(car.feet)
  const side = bounds.max.x
  // The player faces the car (local -x), turned a little toward the door hinge.
  const facing = new THREE.Vector3(-1, 0, -0.35).applyQuaternion(car.quaternion)
  return {
    door: world(side + 0.55, seat.z + 0.75),
    seat: world(side - 0.45, seat.z),
    clear: world(side + 1.3, seat.z - 1.1),
    face: Math.atan2(facing.x, facing.z),
  }
}
