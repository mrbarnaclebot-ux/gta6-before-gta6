import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { AimPose } from './aim-pose'
import { GUN_HAND, type Figure } from './figure'
import type { AnimState } from './movement'

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
  dead: 'Death01',
  // Reaching for the door handle and hauling: the closest clip to pulling a driver out.
  pull: 'Interact',
}

// ponytail: estimated in-place stride speeds; measure foot travel if sliding shows.
const NOMINAL_SPEED: Partial<Record<AnimState, number>> = { walk: 1.7, run: 6, swim: 1.6 }

/** The player's character: a clone of a figure with cross-faded clips and the pistol layer. */
export class Avatar {
  readonly root: THREE.Object3D
  readonly pistol: AimPose
  /** Raise the gun this frame, at this elevation in radians. Set by the shooter. */
  readonly aim = { on: false, elevation: 0 }
  private readonly mixer: THREE.AnimationMixer
  private readonly actions = new Map<AnimState, THREE.AnimationAction>()
  private state: AnimState | null = null

  constructor(figure: Figure) {
    this.root = clone(figure.root)
    this.pistol = new AimPose(this.root, figure)
    this.mixer = new THREE.AnimationMixer(this.root)
    for (const [state, name] of Object.entries(CLIPS) as [AnimState, string][]) {
      const clip = figure.clip(name)
      if (!clip) continue
      const action = this.mixer.clipAction(clip)
      if (state === 'jump' || state === 'dead') {
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
      }
      this.actions.set(state, action)
    }
  }

  /** Where the gun goes: turns like the mannequin's right hand on any rig. */
  get hand(): THREE.Object3D {
    return this.root.getObjectByName(GUN_HAND) ?? this.root
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
    this.mixer.update(dt)
    this.pistol.apply(dt, this.aim.on, this.aim.elevation)
  }
}
