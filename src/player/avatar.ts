import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AimPose } from './aim-pose'
import type { AnimState } from './movement'

const URL = '/assets/models/character/mannequin_ual.glb'
const FADE = 0.2

const CLIPS: Record<AnimState, string> = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  run: 'Sprint_Loop',
  jump: 'Jump_Start',
  fall: 'Jump_Loop',
  swim: 'Swim_Fwd_Loop',
  tread: 'Swim_Idle_Loop',
  drive: 'Driving_Loop',
}

// ponytail: estimated in-place stride speeds; measure foot travel if sliding shows.
const NOMINAL_SPEED: Partial<Record<AnimState, number>> = { walk: 1.7, run: 6, swim: 1.6 }

/** The visible character: the rigged mannequin with cross-faded clips, or a capsule if it fails to load. */
export class Avatar {
  private mixer: THREE.AnimationMixer | null = null
  private actions = new Map<AnimState, THREE.AnimationAction>()
  private state: AnimState | null = null
  /** Every clip in the glb, for cloned figures such as target dummies. */
  clips: THREE.AnimationClip[] = []
  /** The pistol upper-body layer; null on the capsule fallback. */
  pistol: AimPose | null = null
  /** Raise the gun this frame, at this elevation in radians. Set by the shooter. */
  readonly aim = { on: false, elevation: 0 }

  private constructor(readonly root: THREE.Object3D) {}

  /** The right hand bone (GLTFLoader drops the dot in DEF-hand.R); the root on the capsule fallback. */
  get hand(): THREE.Object3D {
    return this.root.getObjectByName('DEF-handR') ?? this.root
  }

  static async load(load: (url: string) => Promise<GLTF>): Promise<Avatar> {
    try {
      const gltf = await load(URL)
      const avatar = new Avatar(gltf.scene)
      avatar.dress()
      avatar.bind(gltf.animations)
      return avatar
    } catch (err) {
      console.warn('Character model failed to load, using a capsule', err)
      const mat = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.6 })
      const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 8, 16), mat)
      capsule.position.y = 0.9
      capsule.castShadow = true
      return new Avatar(new THREE.Group().add(capsule))
    }
  }

  /** Swap the toy orange and purple for a neutral clay and graphite crash-test look. */
  private dress(): void {
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const mat = mesh.material as THREE.MeshStandardMaterial
      const joint = mat.name === 'M_Joints'
      mat.color.set(joint ? 0x2b2e33 : 0xd9d3c7)
      mat.roughness = joint ? 0.35 : 0.55
      mat.metalness = joint ? 0.6 : 0
    })
  }

  private bind(clips: THREE.AnimationClip[]): void {
    this.clips = clips
    this.pistol = new AimPose(this.root, clips)
    this.mixer = new THREE.AnimationMixer(this.root)
    for (const [state, name] of Object.entries(CLIPS) as [AnimState, string][]) {
      const clip = THREE.AnimationClip.findByName(clips, name)
      if (!clip) continue
      const action = this.mixer.clipAction(clip)
      if (state === 'jump') {
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
      }
      this.actions.set(state, action)
    }
  }

  play(state: AnimState, speed: number): void {
    const next = this.actions.get(state)
    const nominal = NOMINAL_SPEED[state]
    if (next && nominal) next.timeScale = THREE.MathUtils.clamp(speed / nominal, 0.7, 1.5)
    if (state === this.state || !next) return
    const prev = this.state ? this.actions.get(this.state) : undefined
    next.reset().play()
    if (prev) next.crossFadeFrom(prev, FADE, false)
    this.state = state
  }

  update(dt: number): void {
    this.mixer?.update(dt)
    this.pistol?.apply(dt, this.aim.on, this.aim.elevation)
  }
}
