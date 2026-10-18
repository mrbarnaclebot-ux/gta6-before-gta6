import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { easeAngle } from '../camera/orbit-math'
import { damageAt, hurt, type Health } from '../combat/damage'
import type { Surface } from '../combat/effects'
import { ACTOR_GROUPS, RAPIER, type PhysicsWorld } from '../physics'
import type { Figure } from '../player/figure'
import { loopPoint, type Loop } from './places'
import type { Crossing } from './crossings'

const HP = 60
const WALK = 1.35
const RUN = 5.2
const FADE = 0.25
const FLEE_TIME = 9
// The walk and sprint clips' natural stride speeds, so feet do not slide.
const WALK_CLIP_SPEED = 1.7
const RUN_CLIP_SPEED = 6
const HALF_HEIGHT = 0.55
const RADIUS = 0.35

export type PedState = 'walk' | 'idle' | 'wait' | 'flee' | 'dead'
type Clip = 'walk' | 'run' | 'idle' | 'talk' | 'hit' | 'death'
const CLIPS: Record<Clip, string> = {
  walk: 'Walk_Loop',
  run: 'Sprint_Loop',
  idle: 'Idle_Loop',
  talk: 'Idle_Talking_Loop',
  hit: 'Hit_Chest',
  death: 'Death01',
}

/** Someone on the sidewalk: walks a loop around the block, stops to chat, flees gunfire. */
export class Pedestrian {
  readonly root: THREE.Object3D
  readonly health: Health = { hp: HP, max: HP }
  readonly body: InstanceType<typeof RAPIER.RigidBody>
  readonly collider: InstanceType<typeof RAPIER.Collider>
  readonly position = new THREE.Vector3()
  state: PedState = 'walk'
  /** Seconds in the current state; dead bodies are recycled after a while. */
  timer = 0
  /** Set by the crowd: called with 'assault' or 'murder' when a bullet lands. */
  onShot: (killed: boolean) => void = () => {}
  private loop: Loop = { pts: [], st: [], length: 1, box: { x0: 0, z0: 0, x1: 0, z1: 0 }, face: -1 }
  /** Which of the crowd's loops this is. */
  loopId = -1
  /** On a crosswalk: meters along it, and the loop it leads to. */
  private crossing: { c: Crossing; t: number; len: number; to: Loop } | null = null
  /** Waiting at the curb for the lights, to cross here. */
  waiting: Crossing | null = null
  /** Ground height under a crosswalk point (the road, then the far curb). */
  ground: (x: number, z: number) => number = () => 0
  /** Off the sidewalk loop (a driver pulled from a car): runs straight this way instead. */
  private loose: { x: number; z: number } | null = null
  private s = 0
  private way: 1 | -1 = 1
  private heading = 0
  private readonly mixer: THREE.AnimationMixer
  private readonly actions = new Map<Clip, THREE.AnimationAction>()
  private current: THREE.AnimationAction | null = null

  /** `dress` swaps a mesh's material for this person's tinted copy. */
  constructor(figure: Figure, dress: (m: THREE.Material) => THREE.Material, physics: PhysicsWorld) {
    this.root = clone(figure.root)
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) mesh.material = dress(mesh.material as THREE.Material)
    })
    this.body = physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
    // Bullets and the player's capsule hit people, but cars drive through them (no solver
    // contacts) and the camera does not zoom in when someone walks past (own group).
    const shape = RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS)
      .setTranslation(0, HALF_HEIGHT + RADIUS, 0)
      .setCollisionGroups(ACTOR_GROUPS)
      .setSolverGroups(0)
    this.collider = physics.createCollider(shape, this.body)
    this.mixer = new THREE.AnimationMixer(this.root)
    for (const [clip, name] of Object.entries(CLIPS) as [Clip, string][]) {
      const action = this.mixer.clipAction(figure.clip(name)!)
      if (clip === 'hit' || clip === 'death') action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = clip === 'death'
      this.actions.set(clip, action)
    }
  }

  get alive(): boolean {
    return this.state !== 'dead'
  }

  /** Meters round the current loop. */
  get station(): number {
    return this.s
  }

  get dir(): 1 | -1 {
    return this.way
  }

  get onCrosswalk(): boolean {
    return this.crossing !== null
  }

  /** Start walking `s` meters around `loop` (at curb height `y`), either way round. */
  place(loop: Loop, id: number, s: number, dir: 1 | -1, y: number): void {
    Object.assign(this, { loop, loopId: id, s, way: dir, state: 'walk', timer: 0, loose: null })
    Object.assign(this, { crossing: null, waiting: null })
    this.health.hp = HP
    this.position.y = y
    this.collider.setEnabled(true)
    this.root.visible = true
    this.root.scale.setScalar(0.92 + Math.random() * 0.14)
    this.move(0)
    this.heading = this.target()
    this.play('walk', 0)
  }

  /** A shot was fired near `from`: run the way round the block that leads away from it. */
  scare(from: THREE.Vector3): void {
    if (!this.alive || this.loose) return
    this.state = 'flee'
    this.timer = 0
    this.waiting = null
    // On a crosswalk, run on across it.
    if (this.crossing) return
    const ahead = loopPoint(this.loop, this.s + 6 * this.way)
    const behind = loopPoint(this.loop, this.s - 6 * this.way)
    const away = (p: { x: number; z: number }) => Math.hypot(p.x - from.x, p.z - from.z)
    if (away(behind) > away(ahead)) this.way = this.way === 1 ? -1 : 1
  }

  /** Stop at the curb and wait to cross at `c`. */
  wait(c: Crossing): void {
    Object.assign(this, { state: 'wait', timer: 0, waiting: c })
  }

  /** Step off the curb and walk over the crosswalk `c` to the loop `to` (crowd loop `id`). */
  cross(c: Crossing, to: Loop, id: number): void {
    const len = Math.hypot(c.b.x - c.a.x, c.b.z - c.a.z)
    Object.assign(this, { crossing: { c, t: 0, len, to }, waiting: null, loopId: id, timer: 0 })
    if (this.state === 'wait') this.state = 'walk'
  }

  /** A bullet from `distance` meters lands at `point`. */
  hit(distance: number, point: THREE.Vector3): Surface {
    if (!this.alive) return 'flesh'
    const killed = hurt(this.health, damageAt(distance, point.y - this.position.y))
    this.onShot(killed)
    if (killed) this.die()
    else this.play('hit', 0.08)
    return 'flesh'
  }

  /**
   * Hauled out of a car at `at`, facing `yaw`: staggers in place. `run` then sends them
   * off. The caller moves them while they are being pulled.
   */
  haul(at: THREE.Vector3, yaw: number): void {
    Object.assign(this, { state: 'idle', timer: 0, heading: yaw, loose: { x: 0, z: 0 } })
    this.health.hp = HP
    this.position.copy(at)
    this.body.setTranslation(at, true)
    this.collider.setEnabled(true)
    this.root.visible = true
    this.play('hit', 0.05)
  }

  /** Flee in a straight line along (x, z), off the loop. */
  run(x: number, z: number): void {
    const l = Math.hypot(x, z) || 1
    this.loose = { x: x / l, z: z / l }
    this.state = 'flee'
    this.timer = 0
  }

  die(): void {
    this.state = 'dead'
    this.timer = 0
    this.collider.setEnabled(false)
    this.play('death', 0.1)
  }

  update(dt: number): void {
    this.timer += dt
    this.think()
    const speed = this.state === 'flee' ? RUN : this.state === 'walk' ? WALK : 0
    this.move(speed * dt)
    if (speed > 0) this.heading = easeAngle(this.heading, this.target(), 1 - Math.exp(-8 * dt))
    this.root.position.copy(this.position)
    this.root.rotation.y = this.heading
    this.body.setNextKinematicTranslation(this.position)
    this.animate(speed)
    this.mixer.update(dt)
  }

  /** Walkers sometimes stop to chat; fleeing calms down after a while. */
  private think(): void {
    // ponytail: a loose runner has no sidewalk to go back to, so once calm they vanish and the
    // crowd recycles them (about 45 m off). Walking back to the nearest loop would be nicer.
    if (this.loose && this.state === 'flee' && this.timer > FLEE_TIME) return this.vanish()
    if (this.loose && this.state !== 'flee') return
    if (this.state === 'flee' && this.timer > FLEE_TIME) {
      this.state = 'walk'
      this.timer = 0
    }
    if (this.state === 'walk' && !this.crossing && this.timer > 6 && Math.random() < 0.002) {
      this.state = 'idle'
      this.timer = 0
    }
    if (this.state === 'idle' && this.timer > 4) {
      this.state = 'walk'
      this.timer = 0
    }
  }

  private animate(speed: number): void {
    const hit = this.actions.get('hit')!
    if (this.current === hit && hit.time < hit.getClip().duration - FADE) return
    if (this.state === 'dead') return
    const s = this.state
    const clip: Clip = s === 'flee' ? 'run' : s === 'walk' ? 'walk' : s === 'wait' ? 'idle' : 'talk'
    const action = this.actions.get(clip)!
    if (speed > 0) action.timeScale = speed / (clip === 'run' ? RUN_CLIP_SPEED : WALK_CLIP_SPEED)
    this.play(clip, FADE)
  }

  private vanish(): void {
    Object.assign(this, { state: 'dead', timer: Infinity, loose: null })
    this.collider.setEnabled(false)
    this.root.visible = false
  }

  private move(step: number): void {
    if (this.loose) {
      this.position.x += this.loose.x * step
      this.position.z += this.loose.z * step
      return
    }
    if (this.crossing) return this.over(step)
    this.s += step * this.way
    const p = loopPoint(this.loop, this.s)
    this.position.x = p.x
    this.position.z = p.z
  }

  /** Along the crosswalk, down onto the road and up the far curb; then onto the far loop. */
  private over(step: number): void {
    const x = this.crossing!
    x.t += step
    const f = Math.min(1, x.t / x.len)
    this.position.x = x.c.a.x + (x.c.b.x - x.c.a.x) * f
    this.position.z = x.c.a.z + (x.c.b.z - x.c.a.z) * f
    this.position.y = this.ground(this.position.x, this.position.z)
    if (f < 1) return
    Object.assign(this, {
      loop: x.to,
      s: x.c.s2,
      crossing: null,
      way: Math.random() < 0.5 ? 1 : -1,
    })
  }

  /** Yaw facing along the loop in the walking direction. */
  private target(): number {
    if (this.loose) return Math.atan2(this.loose.x, this.loose.z) || this.heading
    const c = this.crossing?.c
    if (c) return Math.atan2(c.b.x - c.a.x, c.b.z - c.a.z)
    const p = loopPoint(this.loop, this.s)
    return Math.atan2(p.dx * this.way, p.dz * this.way)
  }

  private play(clip: Clip, fade: number): void {
    const next = this.actions.get(clip)!
    if (next === this.current && clip !== 'hit') return
    next.reset().play()
    if (this.current && fade > 0) next.crossFadeFrom(this.current, fade, false)
    else this.current?.stop()
    this.current = next
  }
}
