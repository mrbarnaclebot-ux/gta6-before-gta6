import * as THREE from 'three'
import { CURB_H, type Rect } from '../city/layout'
import { surfaceAt } from '../city/terrain'
import type { Land } from '../land/plan'
import type { PhysicsWorld } from '../physics'
import { ACTOR_SHADOW_RANGE, castShadows } from '../render/actor-shadows'
import type { Figure } from '../player/figure'
import { DYES, outfit } from './outfit'
import { Pedestrian } from './pedestrian'
import { loopPoint, walkLoops, type Loop } from './places'
import { crossings, type Crossing } from './crossings'
import { mayCross, signalClock } from './signals'

// ponytail: a fixed pool of 24 people kept within 130 m of the player; a density map per
// district can come later.
const COUNT = 24
const NEAR = 30
const FAR = 130
const DESPAWN = 170
const DEAD_FOR = 25
const SCARE_RADIUS = 45
const IMPACT_RADIUS = 15
/** Share of people reaching a crosswalk who take it, and the red they need left to start. */
const CROSS_CHANCE = 0.4
const CROSS_NEED = 10
const GIVE_UP = 45

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
  private readonly loops: Loop[]
  /** Crosswalks starting on each loop. */
  private readonly ways: Crossing[][]
  private readonly local = new THREE.Vector3()
  private readonly inverse = new THREE.Quaternion()

  constructor(
    scene: THREE.Scene,
    physics: PhysicsWorld,
    layout: Land,
    people: Figure[],
    onShot: (killed: boolean) => void,
  ) {
    this.loops = walkLoops(layout)
    this.ways = this.loops.map(() => [])
    for (const c of crossings(layout, this.loops)) this.ways[c.from].push(c)
    const ground = (x: number, z: number) => surfaceAt(layout, x, z)
    const dress = wardrobe()
    this.people = Array.from({ length: COUNT }, (_, i) => {
      // Outfit 0 is the player's own clothes: never on the street.
      const dye = 1 + ((Math.floor(i / people.length) + i) % (DYES.length - 1))
      const p = new Pedestrian(people[i % people.length], dress(dye), physics)
      p.onShot = onShot
      p.ground = ground
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
      if (!p.root.visible) continue
      const before = p.station
      p.update(dt)
      this.atCurb(p, before)
      castShadows(p.root, p.position.distanceTo(focus) < ACTOR_SHADOW_RANGE)
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

  /** People alive and out on the street within `radius` of a point: witnesses. */
  near(at: THREE.Vector3, radius: number): number {
    return this.people.filter(
      (p) => p.alive && p.root.visible && p.position.distanceTo(at) < radius,
    ).length
  }

  /**
   * Someone to play a car's driver: a person off screen if any, else the farthest away.
   * ponytail: in a crowd with nobody off screen, the farthest visible person pops to the door;
   * a pooled extra driver figure would remove the pop.
   */
  borrow(from: THREE.Vector3): Pedestrian {
    const far = (p: Pedestrian) => (p.root.visible ? p.position.distanceTo(from) : Infinity)
    return this.people.reduce((a, b) => (far(b) > far(a) ? b : a))
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

  /** At a crosswalk: some people cross, waiting for the lights where there are any. */
  private atCurb(p: Pedestrian, before: number): void {
    const go = (c: Crossing) =>
      !c.signal || mayCross(c.junction, c.phase, signalClock.t, CROSS_NEED)
    if (p.state === 'wait') {
      const c = p.waiting!
      if (go(c)) p.cross(c, this.loops[c.to], c.to)
      else if (p.timer > GIVE_UP) Object.assign(p, { state: 'walk', waiting: null })
      return
    }
    if (p.state !== 'walk' || p.onCrosswalk) return
    const loop = this.loops[p.loopId]
    const c = this.ways[p.loopId]?.find((w) => passed(before, p.station, w.s, loop.length))
    if (!c || Math.random() > CROSS_CHANCE) return
    if (go(c)) p.cross(c, this.loops[c.to], c.to)
    else p.wait(c)
  }

  private respawn(p: Pedestrian, focus: THREE.Vector3, near: number): void {
    const nearby = this.loops.map((_, i) => i).filter((i) => gap(this.loops[i].box, focus) < FAR)
    for (let tries = 0; tries < 12 && nearby.length; tries++) {
      const id = nearby[Math.floor(Math.random() * nearby.length)]
      const loop = this.loops[id]
      const s = Math.random() * loop.length
      const at = loopPoint(loop, s)
      const d = Math.hypot(at.x - focus.x, at.z - focus.z)
      if (d < near || d > FAR) continue
      p.place(loop, id, s, Math.random() < 0.5 ? 1 : -1, CURB_H)
      p.body.setTranslation(p.position, true)
      return
    }
    p.root.visible = false
  }
}

/** True if walking from station a to b (either way, round a loop of length l) passed x. */
function passed(a: number, b: number, x: number, l: number): boolean {
  const m = (v: number) => ((v % l) + l) % l
  const [lo, hi] = b >= a ? [m(a), m(b)] : [m(b), m(a)]
  const t = m(x)
  return lo <= hi ? t > lo && t <= hi : t > lo || t <= hi
}
