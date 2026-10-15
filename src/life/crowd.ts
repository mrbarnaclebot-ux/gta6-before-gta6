import * as THREE from 'three'
import { CURB_H, type CityLayout, type Rect } from '../city/layout'
import type { PhysicsWorld } from '../physics'
import type { Figure } from '../player/figure'
import { DYES, outfit } from './outfit'
import { Pedestrian } from './pedestrian'
import { loopPoint, perimeter, walkLoops } from './places'

// ponytail: a fixed pool of 24 people kept within 130 m of the player; a density
// map per district and real crossings at intersections can come later.
const COUNT = 24
const NEAR = 30
const FAR = 130
const DESPAWN = 170
const DEAD_FOR = 25
const SCARE_RADIUS = 45
const IMPACT_RADIUS = 15

/** Shares one dyed copy of each source material per outfit across the whole crowd. */
function wardrobe(): (dye: number) => (m: THREE.Material) => THREE.Material {
  const made = new Map<string, THREE.Material>()
  return (dye) => (m) => {
    const key = `${m.uuid}|${dye}`
    if (!made.has(key)) made.set(key, outfit(m, dye))
    return made.get(key)!
  }
}

/** Distance from a point to the nearest point of a rect, 0 inside it. */
const gap = (r: Rect, p: THREE.Vector3) =>
  Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.z0 - p.z, 0, p.z - r.z1))

type RunOver = { position: THREE.Vector3; quaternion: THREE.Quaternion; speed: number }

/** The people on the sidewalks around the player, recycled as the player moves. */
export class Crowd {
  readonly people: Pedestrian[]
  private readonly loops: Rect[]
  private readonly local = new THREE.Vector3()
  private readonly inverse = new THREE.Quaternion()

  constructor(
    scene: THREE.Scene,
    physics: PhysicsWorld,
    layout: CityLayout,
    people: Figure[],
    onShot: (killed: boolean) => void,
  ) {
    this.loops = walkLoops(layout)
    const dress = wardrobe()
    this.people = Array.from({ length: COUNT }, (_, i) => {
      // Outfit 0 is the player's own clothes: never on the street.
      const dye = 1 + ((Math.floor(i / people.length) + i) % (DYES.length - 1))
      const p = new Pedestrian(people[i % people.length], dress(dye), physics)
      p.onShot = onShot
      p.root.visible = false
      p.state = 'dead'
      p.timer = Infinity
      scene.add(p.root)
      return p
    })
  }

  /** Respawn anyone too far away or long dead, then animate everyone. */
  update(dt: number, focus: THREE.Vector3, firstFill = false): void {
    for (const p of this.people) {
      const far = p.position.distanceTo(focus) > DESPAWN
      if (far || (!p.alive && p.timer > DEAD_FOR)) this.respawn(p, focus, firstFill ? 4 : NEAR)
      if (p.root.visible) p.update(dt)
    }
  }

  /** Gunfire from `from` landing at `to`: people near either end run. */
  scare(from: THREE.Vector3, to: THREE.Vector3): void {
    for (const p of this.people) {
      if (p.position.distanceTo(from) < SCARE_RADIUS || p.position.distanceTo(to) < IMPACT_RADIUS) {
        p.scare(from)
      }
    }
  }

  /** People alive within `radius` of a point: witnesses. */
  near(at: THREE.Vector3, radius: number): number {
    return this.people.filter((p) => p.alive && p.position.distanceTo(at) < radius).length
  }

  /** Knock down anyone in front of or under a fast car. Returns how many were hit. */
  runOver(car: RunOver): number {
    if (Math.abs(car.speed) < 4) return 0
    this.inverse.copy(car.quaternion).invert()
    let hits = 0
    for (const p of this.people) {
      if (!p.alive) continue
      this.local.copy(p.position).sub(car.position).applyQuaternion(this.inverse)
      if (Math.abs(this.local.x) > 1.3 || Math.abs(this.local.z) > 2.6) continue
      p.die()
      hits++
    }
    return hits
  }

  private respawn(p: Pedestrian, focus: THREE.Vector3, near: number): void {
    const nearby = this.loops.filter((l) => gap(l, focus) < FAR)
    for (let tries = 0; tries < 12 && nearby.length; tries++) {
      const loop = nearby[Math.floor(Math.random() * nearby.length)]
      const s = Math.random() * perimeter(loop)
      const at = loopPoint(loop, s)
      const d = Math.hypot(at.x - focus.x, at.z - focus.z)
      if (d < near || d > FAR) continue
      p.place(loop, s, Math.random() < 0.5 ? 1 : -1, CURB_H)
      p.body.setTranslation(p.position, true)
      return
    }
    p.root.visible = false
  }
}
