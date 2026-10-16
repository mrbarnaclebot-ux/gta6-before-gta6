import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Land } from '../land/plan'
import { surfaceAt } from '../city/terrain'
import { RAPIER, type PhysicsWorld } from '../physics'
import type { Figure } from '../player/figure'
import { damageAt, hurt, type Health } from './damage'
import type { Surface } from './effects'

const HP = 100
const RESPAWN_AFTER = 6
const FADE = 0.15
// Matches the player's capsule: 1.8 m tall.
const HALF_HEIGHT = 0.55
const RADIUS = 0.35

/** Crash-test yellow with black joints, so the targets read at a glance against sand and sea. */
function dummyMaterials() {
  return {
    body: new THREE.MeshStandardMaterial({ color: 0xe0b32e, roughness: 0.45 }),
    joint: new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.4, metalness: 0.5 }),
  }
}

/** A target dummy: the player's mannequin, re-skinned, that flinches, falls, and stands back up. */
export class Dummy {
  readonly health: Health = { hp: HP, max: HP }
  readonly collider: InstanceType<typeof RAPIER.Collider>
  readonly root: THREE.Object3D
  private readonly mixer: THREE.AnimationMixer
  private readonly idle: THREE.AnimationAction
  private readonly flinch: THREE.AnimationAction
  private readonly death: THREE.AnimationAction
  private current: THREE.AnimationAction
  private deadFor = 0

  constructor(
    source: Figure,
    mats: ReturnType<typeof dummyMaterials>,
    physics: PhysicsWorld,
    readonly feet: THREE.Vector3,
    heading: number,
  ) {
    this.root = clone(source.root)
    this.root.position.copy(feet)
    this.root.rotation.set(0, heading, 0)
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.material = (mesh.material as THREE.Material).name === 'M_Joints' ? mats.joint : mats.body
    })
    const desc = RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS)
    this.collider = physics.createCollider(
      desc.setTranslation(feet.x, feet.y + HALF_HEIGHT + RADIUS, feet.z),
    )
    this.mixer = new THREE.AnimationMixer(this.root)
    const act = (name: string) => this.mixer.clipAction(source.clip(name)!)
    this.idle = act('Idle_Loop').play()
    this.idle.time = Math.random() * 2
    this.flinch = act('Hit_Chest').setLoop(THREE.LoopOnce, 1)
    this.death = act('Death01').setLoop(THREE.LoopOnce, 1)
    this.death.clampWhenFinished = true
    this.current = this.idle
  }

  /** A bullet arriving from `distance` meters lands at `point`. */
  hit(distance: number, point: THREE.Vector3): Surface {
    const killed = hurt(this.health, damageAt(distance, point.y - this.feet.y))
    if (killed) {
      this.collider.setEnabled(false)
      this.deadFor = 0
      this.swap(this.death)
    } else if (this.health.hp > 0) {
      this.swap(this.flinch)
    }
    return 'flesh'
  }

  update(dt: number): void {
    this.mixer.update(dt)
    if (this.current === this.flinch && this.flinch.time > this.flinch.getClip().duration - FADE) {
      this.swap(this.idle)
    }
    if (this.health.hp > 0) return
    this.deadFor += dt
    if (this.deadFor < RESPAWN_AFTER) return
    this.health.hp = HP
    this.collider.setEnabled(true)
    this.swap(this.idle)
  }

  private swap(next: THREE.AnimationAction): void {
    const prev = this.current
    this.current = next
    next.reset().play()
    if (prev !== next) next.crossFadeFrom(prev, FADE, false)
  }
}

/** Three dummies on the sand east of the spawn, facing it, clear of the beach palms. */
export function placeDummies(
  source: Figure,
  physics: PhysicsWorld,
  layout: Land,
  spawn: THREE.Vector3,
): Dummy[] {
  const mats = dummyMaterials()
  const x = layout.land.x1 + 12
  return [-5, 0, 5].map((dz) => {
    let z = spawn.z + dz
    while (layout.palms.some((p) => Math.hypot(p.x - x, p.z - z) < 1.6)) z += 0.5
    const feet = new THREE.Vector3(x, surfaceAt(layout, x, z), z)
    return new Dummy(source, mats, physics, feet, Math.atan2(spawn.x - x, spawn.z - z))
  })
}
