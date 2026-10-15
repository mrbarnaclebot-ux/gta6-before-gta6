import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { easeAngle } from '../camera/orbit-math'
import type { Rect } from '../city/layout'
import { damageAt, hurt, type Health } from '../combat/damage'
import type { Surface } from '../combat/effects'
import { ACTOR_GROUPS, RAPIER, type PhysicsWorld } from '../physics'
import type { Avatar } from '../player/avatar'
import { loopPoint } from './places'

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

export type PedState = 'walk' | 'idle' | 'flee' | 'dead'
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
  private loop: Rect = { x0: 0, z0: 0, x1: 1, z1: 1 }
  private s = 0
  private dir: 1 | -1 = 1
  private heading = 0
  private readonly mixer: THREE.AnimationMixer
  private readonly actions = new Map<Clip, THREE.AnimationAction>()
  private current: THREE.AnimationAction | null = null

  constructor(source: Avatar, materials: THREE.Material[], physics: PhysicsWorld) {
    this.root = clone(source.root)
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const joint = (mesh.material as THREE.Material).name === 'M_Joints'
      mesh.material = materials[joint ? 1 : 0]
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
      const action = this.mixer.clipAction(THREE.AnimationClip.findByName(source.clips, name)!)
      if (clip === 'hit' || clip === 'death') action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = clip === 'death'
      this.actions.set(clip, action)
    }
  }

  get alive(): boolean {
    return this.state !== 'dead'
  }

  /** Start walking `s` meters around `loop` (at curb height `y`), either way round. */
  place(loop: Rect, s: number, dir: 1 | -1, y: number): void {
    Object.assign(this, { loop, s, dir, state: 'walk', timer: 0 })
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
    if (!this.alive) return
    const ahead = loopPoint(this.loop, this.s + 6 * this.dir)
    const behind = loopPoint(this.loop, this.s - 6 * this.dir)
    const away = (p: { x: number; z: number }) => Math.hypot(p.x - from.x, p.z - from.z)
    if (away(behind) > away(ahead)) this.dir = this.dir === 1 ? -1 : 1
    this.state = 'flee'
    this.timer = 0
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
    if (this.state === 'flee' && this.timer > FLEE_TIME) {
      this.state = 'walk'
      this.timer = 0
    }
    if (this.state === 'walk' && this.timer > 6 && Math.random() < 0.002) {
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
    const clip: Clip = this.state === 'flee' ? 'run' : this.state === 'walk' ? 'walk' : 'talk'
    const action = this.actions.get(clip)!
    if (speed > 0) action.timeScale = speed / (clip === 'run' ? RUN_CLIP_SPEED : WALK_CLIP_SPEED)
    this.play(clip, FADE)
  }

  private move(step: number): void {
    this.s += step * this.dir
    const p = loopPoint(this.loop, this.s)
    this.position.x = p.x
    this.position.z = p.z
  }

  /** Yaw facing along the loop in the walking direction. */
  private target(): number {
    const p = loopPoint(this.loop, this.s)
    return Math.atan2(p.dx * this.dir, p.dz * this.dir)
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
