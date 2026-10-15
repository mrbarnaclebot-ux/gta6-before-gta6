import * as THREE from 'three'
import { CURB_H, type CityLayout, type Rect } from '../city/layout'
import type { PhysicsWorld } from '../physics'
import type { Avatar } from '../player/avatar'
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

/** Clothing tints on the mannequin: body, then joints. Light and dark tones, a few Miami colors. */
const OUTFITS: [number, number][] = [
  [0x23324f, 0xd9d3c7],
  [0xc8442f, 0x2b2e33],
  [0xa9b8c9, 0x4a5563],
  [0x1f8f8a, 0xe8e2d4],
  [0xe6a4b4, 0x3a3236],
  [0x2b2b2e, 0xb08d57],
  [0xb9a27a, 0x40362c],
  [0x6a4fa3, 0xf0eadf],
  [0xf3c24b, 0x26282c],
  [0x8a9a5b, 0x2f3329],
]

function outfitMaterials(): THREE.Material[][] {
  return OUTFITS.map(([body, joint]) => [
    new THREE.MeshStandardMaterial({ color: body, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: joint, roughness: 0.5, metalness: 0.2 }),
  ])
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
    avatar: Avatar,
    onShot: (killed: boolean) => void,
  ) {
    this.loops = walkLoops(layout)
    const outfits = outfitMaterials()
    this.people = Array.from({ length: COUNT }, (_, i) => {
      const p = new Pedestrian(avatar, outfits[i % outfits.length], physics)
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
