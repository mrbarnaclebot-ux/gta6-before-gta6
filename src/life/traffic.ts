import * as THREE from 'three'
import type { CityLayout } from '../city/layout'
import { rng } from '../city/rng'
import type { PhysicsWorld } from '../physics'
import { PAINT_COUNT, type CarFactory } from '../vehicle/car-model'
import { lanePoint, randomHeading } from './lanes'
import { TrafficCar } from './traffic-car'

// ponytail: ten cars kept within 220 m of the player, no traffic lights; intersections
// work on "stop for whatever is in front". Lights and a density map can come later.
const COUNT = 10
const NEAR = 60
const FAR = 220
const DESPAWN = 260
const LOOK = 30
const HALF_WIDTH = 1.0
const HALF_LENGTH = 2.4
const STOP_MARGIN = 1.5
const STUCK_AFTER = 3
const IGNORE_FOR = 2

/** Something a driver must not hit: its ground position and rough radius. */
export interface Obstacle {
  x: number
  z: number
  r: number
}

/** The AI cars driving the lanes around the player. */
export class Traffic {
  readonly cars: TrafficCar[]
  private readonly stuck: number[]
  private readonly ignoring: number[]
  private readonly grid: Pick<CityLayout, 'xRoads' | 'zRoads'>
  private readonly r = rng(4242)

  constructor(
    scene: THREE.Scene,
    physics: PhysicsWorld,
    layout: CityLayout,
    make: CarFactory,
    onShot: () => void,
  ) {
    this.grid = layout
    this.cars = Array.from({ length: COUNT }, (_, i) => {
      const car = new TrafficCar(physics, make(i % PAINT_COUNT), layout, this.r)
      car.onShot = onShot
      car.visual.root.visible = false
      scene.add(car.visual.root)
      return car
    })
    this.stuck = this.cars.map(() => 0)
    this.ignoring = this.cars.map(() => 0)
  }

  /**
   * `view` is the camera's forward direction: new cars appear behind it when possible.
   * `others` are the player, cars that are not traffic, and people.
   */
  update(dt: number, focus: THREE.Vector3, view: THREE.Vector3, others: Obstacle[], night: number) {
    this.cars.forEach((car, i) => {
      const hidden = !car.visual.root.visible
      if (hidden || car.position.distanceTo(focus) > DESPAWN) this.spawn(car, focus, view, hidden)
      if (!car.visual.root.visible) return
      const cars = this.ignoring[i] > 0 ? 0 : this.limit(car, this.carObstacles(car))
      const limit = Math.min(cars, this.limit(car, others))
      this.unstick(i, car, cars, limit, dt)
      car.update(dt, limit, night)
    })
  }

  /** Cars still running within `radius` of a point: witnesses. */
  near(at: THREE.Vector3, radius: number): number {
    return this.cars.filter(
      (c) => c.visual.root.visible && !c.dead && c.position.distanceTo(at) < radius,
    ).length
  }

  private carObstacles(self: TrafficCar): Obstacle[] {
    return this.cars
      .filter((c) => c !== self && c.visual.root.visible)
      .map((c) => ({ x: c.position.x, z: c.position.z, r: HALF_WIDTH }))
  }

  /** Top speed that still stops short of the nearest obstacle in this car's path. */
  private limit(car: TrafficCar, list: Obstacle[]): number {
    const fx = Math.sin(car.heading)
    const fz = Math.cos(car.heading)
    let limit = Infinity
    for (const o of list) {
      const dx = o.x - car.position.x
      const dz = o.z - car.position.z
      const ahead = dx * fx + dz * fz
      if (ahead <= 0 || ahead > LOOK || Math.abs(dx * fz - dz * fx) > HALF_WIDTH + o.r) continue
      const gap = ahead - HALF_LENGTH - o.r - STOP_MARGIN
      limit = Math.min(limit, gap <= 0 ? 0 : Math.sqrt(7 * gap))
    }
    return limit
  }

  /** Two cars nose to nose in an intersection would wait forever: after a while, one goes. */
  private unstick(i: number, car: TrafficCar, carLimit: number, limit: number, dt: number) {
    this.ignoring[i] = Math.max(0, this.ignoring[i] - dt)
    const blockedByCar = car.speed < 0.2 && carLimit <= limit + 1e-6 && carLimit < 0.5
    this.stuck[i] = blockedByCar ? this.stuck[i] + dt : 0
    if (this.stuck[i] < STUCK_AFTER) return
    this.stuck[i] = 0
    this.ignoring[i] = IGNORE_FOR
  }

  private spawn(car: TrafficCar, focus: THREE.Vector3, view: THREE.Vector3, first: boolean): void {
    for (let tries = 0; tries < 24; tries++) {
      const h = randomHeading(this.grid, this.r)
      const p = lanePoint(h, h.u)
      const dx = p.x - focus.x
      const dz = p.z - focus.z
      const d = Math.hypot(dx, dz)
      if (d < (first ? 20 : NEAR) || d > FAR) continue
      if (!first && tries < 16 && dx * view.x + dz * view.z > 0 && d < 140) continue
      if (
        this.cars.some((c) => c !== car && Math.hypot(c.position.x - p.x, c.position.z - p.z) < 20)
      )
        continue
      car.place(h)
      car.visual.root.visible = true
      return
    }
  }
}
