import * as THREE from 'three'
import { CURB_H, type CityLayout } from '../city/layout'
import type { PhysicsWorld } from '../physics'
import type { Avatar } from '../player/avatar'
import type { Player } from '../player/player'
import type { CarFactory } from '../vehicle/car-model'
import type { Driving } from '../vehicle/driving'
import { Crowd } from './crowd'
import { hospitals, nearest, type Hospital } from './places'
import { Traffic, type Obstacle } from './traffic'
import { clear, cool, newWanted, report, type Crime } from './wanted'

/** Gunfire is a crime only with a witness this close: a person or a driver. */
const WITNESS = 40
/** Seconds on the ground before waking up at the hospital. */
export const RESPAWN_AFTER = 5

interface LifeDeps {
  scene: THREE.Scene
  physics: PhysicsWorld
  layout: CityLayout
  avatar: Avatar
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
  /** Where the player last woke up, for the HUD and tests. */
  revivedAt: Hospital | null = null
  /** Called after waking up in hospital, so the game can restock the pistol. */
  onRevive: () => void = () => {}
  private shots = 0
  private filled = false
  private readonly player: Player
  private readonly driving: Driving

  constructor(d: LifeDeps) {
    this.player = d.player
    this.driving = d.driving
    this.crowd = new Crowd(d.scene, d.physics, d.layout, d.avatar, (killed) =>
      this.crime(killed ? 'murder' : 'assault'),
    )
    this.traffic = new Traffic(d.scene, d.physics, d.layout, d.makeCar, () =>
      this.crime('vandalism'),
    )
    this.hospitals = hospitals(d.layout)
  }

  /** Everyone and everything on the street that a bullet can hit. */
  get targets() {
    return [...this.crowd.people, ...this.traffic.cars]
  }

  get dead(): boolean {
    return this.deadFor !== null
  }

  /** `view`: camera forward. `shot`: the shooter's latest shot. `night`: 0 to 1, for car lamps. */
  update(dt: number, view: THREE.Vector3, shot: Shot, night: number): void {
    const focus = this.driving.position
    this.crowd.update(dt, focus, !this.filled)
    this.traffic.update(dt, focus, view, this.obstacles(), night)
    this.filled = true
    if (shot.count !== this.shots) {
      this.shots = shot.count
      this.gunfire(shot)
    }
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
    if (seen > 0) this.crime('gunshot')
  }

  private crime(c: Crime): void {
    const p = this.driving.position
    report(this.wanted, c, p.x, p.z)
  }

  /** What traffic must stop for: the player, every other car, and people. */
  private obstacles(): Obstacle[] {
    const list: Obstacle[] = this.driving.cars.map((c) => ({
      x: c.position.x,
      z: c.position.z,
      r: 1,
    }))
    if (!this.driving.car)
      list.push({ x: this.player.position.x, z: this.player.position.z, r: 0.4 })
    for (const p of this.crowd.people) {
      if (p.alive && p.root.visible) list.push({ x: p.position.x, z: p.position.z, r: 0.4 })
    }
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
    this.revivedAt = h
    this.deadFor = null
    this.onRevive()
  }
}
