import * as THREE from 'three'
import { CURB_H, type CityLayout } from '../city/layout'
import type { PhysicsWorld } from '../physics'
import type { Figure } from '../player/figure'
import type { Player } from '../player/player'
import type { CarFactory } from '../vehicle/car-model'
import type { Driving } from '../vehicle/driving'
import { Crowd } from './crowd'
import { hospitals, nearest, type Hospital } from './places'
import { Traffic, type Obstacle } from './traffic'
import { clear, cool, newWanted, report, stars, type Crime } from './wanted'

/** Gunfire is a crime only with a witness this close: a person or a driver. */
const WITNESS = 40
/** Seconds on the ground before waking up at the hospital. */
export const RESPAWN_AFTER = 5

interface LifeDeps {
  scene: THREE.Scene
  physics: PhysicsWorld
  layout: CityLayout
  /** The kinds of people on the sidewalks; they take turns. */
  people: Figure[]
  makeCar: CarFactory
  player: Player
  driving: Driving
}

/** The latest shot: who fired from where, and where it landed. */
export interface Shot {
  count: number
  from: THREE.Vector3
  to: THREE.Vector3
}

/** The living city: people, traffic, the wanted level, and dying and waking up in hospital. */
export class Life {
  readonly wanted = newWanted()
  readonly crowd: Crowd
  readonly traffic: Traffic
  readonly hospitals: Hospital[]
  /** Seconds since the player died; null while alive. */
  deadFor: number | null = null
  /** Called after waking up in hospital, so the game can restock the pistol. */
  onRevive: () => void = () => {}
  private shots = 0
  /** A bullet hit someone or something this frame, which already counts as a crime. */
  private struck = false
  private readonly obstacleList: Obstacle[] = []
  private filled = false
  private readonly player: Player
  private readonly driving: Driving

  constructor(d: LifeDeps) {
    this.player = d.player
    this.driving = d.driving
    this.crowd = new Crowd(d.scene, d.physics, d.layout, d.people, (killed) =>
      this.struckBy(killed ? 'murder' : 'assault'),
    )
    this.traffic = new Traffic(d.scene, d.physics, d.layout, d.makeCar, () =>
      this.struckBy('vandalism'),
    )
    this.hospitals = hospitals(d.layout)
  }

  get dead(): boolean {
    return this.deadFor !== null
  }

  /** `view`: camera forward. `shot`: the shooter's latest shot. `night`: 0 to 1, for car lamps. */
  update(dt: number, view: THREE.Vector3, shot: Shot, night: number): void {
    const focus = this.driving.position
    this.crowd.update(dt, focus, !this.filled)
    const siren = stars(this.wanted) > 0
    this.traffic.update(dt, focus, view, this.obstacles(), { night, siren })
    this.filled = true
    if (shot.count !== this.shots) {
      this.shots = shot.count
      this.gunfire(shot)
    }
    this.struck = false
    const car = this.driving.car
    if (car && this.crowd.runOver(car)) this.crime('runover')
    cool(this.wanted, focus.x, focus.z, dt)
    this.death(dt)
  }

  private gunfire(shot: Shot): void {
    this.crowd.scare(shot.from, shot.to)
    const seen =
      this.crowd.near(shot.from, WITNESS) +
      this.crowd.near(shot.to, WITNESS / 2) +
      this.traffic.near(shot.from, WITNESS)
    // Each shot is one crime: a hit already reported as assault or vandalism is not also gunfire.
    if (seen > 0 && !this.struck) this.crime('gunshot')
  }

  private struckBy(c: Crime): void {
    this.struck = true
    this.crime(c)
  }

  private crime(c: Crime): void {
    const p = this.driving.position
    report(this.wanted, c, p.x, p.z)
  }

  /** What traffic must stop for: the player, every other car, and people. */
  private obstacles(): Obstacle[] {
    const list = this.obstacleList
    let n = 0
    // Reuses the same objects every frame: this runs at render rate.
    const add = (x: number, z: number, r: number) => {
      const o = (list[n++] ??= { x, z, r })
      o.x = x
      o.z = z
      o.r = r
    }
    for (const c of this.driving.cars) add(c.position.x, c.position.z, 1)
    if (!this.driving.car) add(this.player.position.x, this.player.position.z, 0.4)
    for (const p of this.crowd.people) {
      if (p.alive && p.root.visible) add(p.position.x, p.position.z, 0.4)
    }
    list.length = n
    return list
  }

  private death(dt: number): void {
    if (this.deadFor === null) {
      if (this.player.vitals.health > 0) return
      this.deadFor = 0
      this.driving.leave()
      return
    }
    this.deadFor += dt
    if (this.deadFor < RESPAWN_AFTER) return
    const p = this.player.position
    const h = nearest(this.hospitals, p.x, p.z)
    this.player.revive(new THREE.Vector3(h.x, CURB_H + 0.05, h.z))
    clear(this.wanted)
    this.deadFor = null
    this.onRevive()
  }
}
