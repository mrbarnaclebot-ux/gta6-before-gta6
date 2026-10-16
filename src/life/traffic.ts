import * as THREE from 'three'
import type { CityLayout } from '../city/layout'
import { rng } from '../city/rng'
import { RAPIER, type PhysicsWorld } from '../physics'
import { ACTOR_SHADOW_RANGE, castShadows } from '../render/actor-shadows'
import { PAINT_COUNT, type CarFactory } from '../vehicle/car-model'
import { laneGraph, type LaneEdge } from '../land/lane-graph'
import type { Land } from '../land/plan'
import { canJack, driverWaits } from './carjack-rules'
import { highwayStart } from './highway-traffic'
import { gridStart, randomHeading } from './lanes'
import { TrafficCar } from './traffic-car'

// ponytail: ten cars kept within 220 m of the player, no traffic lights; intersections
// work on "stop for whatever is in front". Lights and a density map can come later.
const COUNT = 10
// Every third car is a police cruiser: a patrol, not a pursuit.
const POLICE_EVERY = 3
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
  y: number
  z: number
  r: number
}

// Things farther apart than this in height are on different levels: a bridge and the road under it.
const LEVEL = 3

const DOWN = { x: 0, y: -1, z: 0 }
const NUDGE = 0.0013
// Only fixed colliders are ground: not cars, people, or the traffic itself.
const SOLID_ONLY =
  RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC |
  RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC |
  RAPIER.QueryFilterFlags.EXCLUDE_SENSORS

/** The road surface under a wheel: a ray down from 1.5 m above the lane, at most 4 m long. */
export function groundProbe(physics: PhysicsWorld) {
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, DOWN)
  return (x: number, y: number, z: number): number | null => {
    // Rapier's heightfield misses rays that run exactly down a grid line (lanes sit on whole meters).
    ray.origin.x = x + NUDGE
    ray.origin.y = y + 1.5
    ray.origin.z = z + NUDGE
    const hit = physics.castRay(ray, 4, true, SOLID_ONLY)
    return hit ? y + 1.5 - hit.timeOfImpact : null
  }
}

/** The AI cars driving the lanes around the player. */
export class Traffic {
  readonly cars: TrafficCar[]
  private readonly stuck: number[]
  private readonly ignoring: number[]
  private readonly grid: Pick<CityLayout, 'xRoads' | 'zRoads'>
  private readonly highway: LaneEdge[]
  private readonly r = rng(4242)
  private readonly others: Obstacle[] = []
  /** Cars made so far, so a replacement gets a different paint from the one it replaces. */
  private made = 0

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    layout: Land,
    private readonly make: CarFactory,
    private readonly onShot: () => void,
  ) {
    this.grid = layout
    const hw = layout.paths.find((p) => p.kind === 'highway')!
    this.highway = laneGraph(
      hw,
      layout.paths.filter((p) => p.kind === 'ramp'),
    )
    this.cars = Array.from({ length: COUNT }, (_, i) =>
      this.create(i % POLICE_EVERY === 0 ? 'police' : 'sports'),
    )
    this.stuck = this.cars.map(() => 0)
    this.ignoring = this.cars.map(() => 0)
  }

  private create(kind: 'police' | 'sports'): TrafficCar {
    const car = new TrafficCar(this.physics, this.make(this.made++ % PAINT_COUNT, kind))
    car.onShot = this.onShot
    car.ground = groundProbe(this.physics)
    car.visual.root.visible = false
    this.scene.add(car.visual.root)
    return car
  }

  /** The car whose driver the player at `p` could pull out right now, if any. */
  jackable(p: THREE.Vector3): TrafficCar | null {
    let best: TrafficCar | null = null
    let bestD = Infinity
    for (const c of this.cars) {
      const d = c.position.distanceTo(p)
      if (c.visual.root.visible && canJack(c.speed, d, c.dead) && d < bestD) [best, bestD] = [c, d]
    }
    return best
  }

  /**
   * Hands a stolen car over: its AI body leaves the physics world and a fresh car of the
   * same kind takes its place in the pool (it appears out of sight, like any other).
   */
  release(car: TrafficCar): TrafficCar {
    const i = this.cars.indexOf(car)
    this.physics.removeRigidBody(car.body)
    const fresh = this.create(car.visual.police ? 'police' : 'sports')
    this.cars[i] = fresh
    this.stuck[i] = this.ignoring[i] = 0
    return fresh
  }

  /**
   * `view` is the camera's forward direction: new cars appear behind it when possible.
   * `others` are the player, cars that are not traffic, and people. `walker`: the player
   * on foot, whom a slow driver waits for (null while driving).
   */
  update(
    dt: number,
    focus: THREE.Vector3,
    view: THREE.Vector3,
    others: Obstacle[],
    lights: { night: number; siren: boolean; walker: THREE.Vector3 | null },
  ) {
    this.cars.forEach((car, i) => {
      const hidden = !car.visual.root.visible
      if (hidden || car.position.distanceTo(focus) > DESPAWN) this.spawn(car, focus, view, hidden)
      if (!car.visual.root.visible) return
      const cars = this.ignoring[i] > 0 ? 0 : this.limit(car, this.carObstacles(car))
      const w = lights.walker
      const waits = car.held || (w !== null && driverWaits(car.speed, car.position.distanceTo(w)))
      const limit = waits ? 0 : Math.min(cars, this.limit(car, others))
      this.unstick(i, car, cars, limit, dt)
      car.update(dt, limit, lights.night, lights.siren)
      castShadows(car.visual.root, car.position.distanceTo(focus) < ACTOR_SHADOW_RANGE)
    })
  }

  /** Cars still running within `radius` of a point (only police with `police`): witnesses. */
  near(at: THREE.Vector3, radius: number, police = false): number {
    return this.cars.filter(
      (c) =>
        c.visual.root.visible &&
        !c.dead &&
        (!police || c.visual.police) &&
        c.position.distanceTo(at) < radius,
    ).length
  }

  /** Every other visible car, in one scratch array reused each call: this runs per car per frame. */
  private carObstacles(self: TrafficCar): Obstacle[] {
    const list = this.others
    let n = 0
    for (const c of this.cars) {
      if (c === self || !c.visual.root.visible) continue
      const o = (list[n++] ??= { x: 0, y: 0, z: 0, r: HALF_WIDTH })
      o.x = c.position.x
      o.y = c.position.y
      o.z = c.position.z
    }
    list.length = n
    return list
  }

  /** Top speed that still stops short of the nearest obstacle in this car's path. */
  private limit(car: TrafficCar, list: Obstacle[]): number {
    const fx = Math.sin(car.heading)
    const fz = Math.cos(car.heading)
    let limit = Infinity
    for (const o of list) {
      if (Math.abs(o.y - car.position.y) > LEVEL) continue
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
      // Every other try is on the highway: near it, those are the ones that land in range.
      const p =
        tries % 2
          ? highwayStart(this.highway, this.r)
          : gridStart(this.grid, randomHeading(this.grid, this.r), this.r)
      const dx = p.x - focus.x
      const dz = p.z - focus.z
      const d = Math.hypot(dx, dz)
      if (d < (first ? 20 : NEAR) || d > FAR) continue
      if (!first && tries < 16 && dx * view.x + dz * view.z > 0 && d < 140) continue
      if (
        this.cars.some((c) => c !== car && Math.hypot(c.position.x - p.x, c.position.z - p.z) < 20)
      )
        continue
      car.place(p)
      car.visual.root.visible = true
      return
    }
  }
}
