import * as THREE from 'three'
import type { FollowCamera } from '../camera/follow-camera'
import type { CityLayout } from '../city/layout'
import type { Input } from '../input/input'
import type { PhysicsWorld } from '../physics'
import type { Player } from '../player/player'
import type { Car } from '../vehicle/car'
import { carCondition } from './damage'
import { placeDummies, type Dummy } from './dummy'
import { Effects } from './effects'
import { Shooter, type Target } from './shooter'

// Puffs per second from a damaged engine.
const SMOKE_RATE = { smoking: 6, wrecked: 14 }

interface CombatDeps {
  scene: THREE.Scene
  physics: PhysicsWorld
  player: Player
  follow: FollowCamera
  cars: Car[]
  layout: CityLayout
  spawn: THREE.Vector3
}

/** Shooting as a whole: the pistol, its targets (dummies and cars), and the effects they make. */
export class Combat {
  readonly shooter: Shooter
  readonly dummies: Dummy[]
  private readonly effects: Effects
  private readonly cars: Car[]
  private readonly hood = new THREE.Vector3()

  constructor(d: CombatDeps) {
    // Clone the mannequin before the gun goes into its hand, so dummies stay unarmed.
    this.dummies = placeDummies(d.player.avatar, d.physics, d.layout, d.spawn)
    d.scene.add(...this.dummies.map((x) => x.root))
    this.effects = new Effects(d.scene)
    this.cars = d.cars
    const targets = new Map<number, Target>()
    for (const t of [...this.dummies, ...d.cars]) targets.set(t.collider.handle, t)
    this.shooter = new Shooter(d.physics, d.player, d.follow, targets, this.effects)
  }

  /** Render-rate update after the camera moves. `armed`: on foot and out of the water. */
  update(dt: number, input: Input, armed: boolean, viewHeight: number): void {
    this.shooter.update(dt, input, armed)
    for (const d of this.dummies) d.update(dt)
    for (const car of this.cars) {
      const state = carCondition(car.health)
      if (state === 'intact' || Math.random() > SMOKE_RATE[state] * dt) continue
      this.effects.carSmoke(car.hood(this.hood), state === 'wrecked')
    }
    this.effects.update(dt, viewHeight)
  }
}
