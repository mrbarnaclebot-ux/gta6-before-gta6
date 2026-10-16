import * as THREE from 'three'
import type { World } from '../game'
import { RUN_SPEED, WALK_SPEED } from '../player/movement'
import type { Sound } from './catalog'
import { Loop } from './loop'
import type { Mixer } from './mixer'
import { StepDetector } from './steps'
import { footingAt, groundOf } from './surface'

const RUNNING = (WALK_SPEED + RUN_SPEED) / 2
const jitter = (amount: number) => 1 + (Math.random() * 2 - 1) * amount
const v = new THREE.Vector3()

/** The player's own body: footsteps by surface, jump and landing, splashes, and swimming. */
export class PlayerAudio {
  private readonly steps = new StepDetector()
  private readonly swim: Loop
  private mode: string
  private air = 0
  private fallSpeed = 0
  private prevVy = 0
  /** Fallback cadence for a rig without foot bones. */
  private stride = 0

  constructor(
    private readonly mixer: Mixer,
    private readonly w: World,
  ) {
    this.swim = new Loop(mixer, 'swim', 'sfx')
    this.mode = w.driving.mode
  }

  update(dt: number): void {
    const { player, driving, life } = this.w
    const mode = life.dead ? 'dead' : driving.mode
    if (mode !== this.mode) this.modeChange(this.mode, mode)
    this.mode = mode
    const m = player.motion
    const speed = Math.hypot(m.vx, m.vz)
    this.swim.set(
      mode === 'swimming' && !this.w.city.underwater ? 0.12 + 0.4 * Math.min(1, speed / 1.6) : 0,
      0.9 + 0.15 * Math.min(1, speed / 2.5),
      dt,
      0.25,
    )
    if (mode !== 'walking') return this.steps.reset()
    this.airborne(dt)
    if (m.airTime === 0 && speed > 0.4) this.footfall(dt, speed)
  }

  private modeChange(from: string, to: string): void {
    if (to === 'swimming') {
      const hard =
        this.fallSpeed > 6 ||
        (from === 'walking' && Math.hypot(this.w.player.motion.vx, this.w.player.motion.vz) > 4)
      this.mixer.play(hard ? 'splash-big' : 'splash-small', {
        gain: hard ? 0.9 : 0.6,
        rate: jitter(0.05),
      })
    } else if (from === 'swimming' && to === 'walking') {
      this.mixer.play('splash-small', { gain: 0.35, rate: 1.15 })
    }
    this.fallSpeed = 0
  }

  /** Jump effort on take-off; a thud scaled by fall speed on landing. */
  private airborne(dt: number): void {
    const m = this.w.player.motion
    if (m.vy - this.prevVy > 4 && m.vy > 3) {
      this.mixer.play('jump', { gain: 0.45, rate: jitter(0.04) })
      this.step(0.4)
    }
    this.prevVy = m.vy
    if (m.airTime > 0) {
      this.air += dt
      this.fallSpeed = Math.max(this.fallSpeed, -m.vy)
      return
    }
    if (this.air > 0.25) {
      const hard = Math.min(1, Math.max(0, (this.fallSpeed - 3) / 12))
      this.mixer.play('land', { gain: 0.3 + 0.7 * hard, rate: jitter(0.05) * (1 - 0.15 * hard) })
      this.step(0.5 + 0.4 * hard)
      this.steps.reset()
    }
    this.air = 0
    this.fallSpeed = 0
  }

  /** A step when a foot comes down in the animation (or on a timer for a rig without feet). */
  private footfall(dt: number, speed: number): void {
    const { avatar } = this.w.player
    const run = speed > RUNNING
    const loud = run ? 0.8 : 0.5
    if (avatar.feet.length === 2) {
      const base = avatar.root.position.y
      const heights = avatar.feet.map((f) => f.getWorldPosition(v).y - base)
      if (this.steps.update(heights, dt) >= 0) this.step(loud, run)
      return
    }
    this.stride += dt
    if (this.stride > (run ? 0.3 : 0.52)) {
      this.stride = 0
      this.step(loud, run)
    }
  }

  /** One footstep on whatever is underfoot, a little different every time. */
  step(gain: number, run = false): void {
    const { player, city } = this.w
    const p = player.position
    if (player.feetDepth > 0.08) {
      return this.mixer.play('splash-small', { gain: gain * 0.4, rate: 1.3 * jitter(0.1) })
    }
    const ground = groundOf(footingAt(city.layout, p.x, p.z, p.y))
    const sound: Sound =
      ground === 'concrete'
        ? run
          ? 'step-run'
          : 'step-concrete'
        : ground === 'sand'
          ? 'step-sand'
          : 'step-grass'
    const soft = ground === 'concrete' ? 1 : 1.3
    this.mixer.play(sound, {
      gain: gain * soft * jitter(0.15),
      rate: jitter(0.06) * (run && ground !== 'concrete' ? 1.08 : 1),
    })
  }
}
