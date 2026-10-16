import type { World } from '../game'
import type { Mixer } from './mixer'
import type { Space } from './space'

/** Seconds between panic screams, so a gunfight is not one long shriek. */
const SCREAM_GAP = 4.5
const jitter = (amount: number) => 1 + (Math.random() * 2 - 1) * amount

/** The pistol and what it starts: shots with a street echo, reloads, dry clicks, hits, casings, and screams. */
export class CombatAudio {
  private shots: number
  private dry: number
  private reloading = false
  private fleeing = 0
  private sinceScream = SCREAM_GAP

  constructor(
    private readonly mixer: Mixer,
    private readonly space: Space,
    private readonly w: World,
  ) {
    this.shots = w.combat.shooter.shots
    this.dry = w.combat.shooter.dryFires
  }

  update(dt: number): void {
    const s = this.w.combat.shooter
    if (s.shots !== this.shots) this.shot()
    this.shots = s.shots
    if (s.dryFires !== this.dry) this.mixer.play('dry', { gain: 0.7, rate: jitter(0.03) })
    this.dry = s.dryFires
    const reloading = s.pistol.reloading > 0
    if (reloading && !this.reloading) this.mixer.play('reload', { gain: 0.7 })
    this.reloading = reloading
    this.panic(dt)
  }

  private shot(): void {
    const { lastShot } = this.w.combat.shooter
    const p = this.w.player.position
    const land = this.w.city.layout.land
    const downtown = p.x > land.x0 && p.x < land.x1 && p.z > land.z0 && p.z < land.z1
    // Between towers the shot slaps back off the walls; out in the open it barely does.
    this.mixer.play('shot', { gain: 1, rate: jitter(0.04), echo: downtown ? 0.55 : 0.2 })
    this.mixer.play('casing', {
      gain: 0.22,
      rate: jitter(0.08),
      delay: 0.45 + Math.random() * 0.25,
    })
    const surface = lastShot.surface
    if (!surface) return
    const sound =
      surface === 'metal' ? 'impact-metal' : surface === 'world' ? 'impact-concrete' : 'land'
    this.space.play(sound, lastShot.to, {
      gain: surface === 'flesh' ? 0.5 : 0.8,
      rate: surface === 'flesh' ? 1.3 : jitter(0.08),
      ref: 3,
    })
  }

  /** When gunfire sends more people running, the nearest of them screams. */
  private panic(dt: number): void {
    this.sinceScream += dt
    const runners = this.w.life.crowd.people.filter((p) => p.state === 'flee' && p.root.visible)
    if (runners.length > this.fleeing && this.sinceScream > SCREAM_GAP) {
      const here = this.w.player.position
      const near = runners.reduce((a, b) =>
        a.position.distanceTo(here) < b.position.distanceTo(here) ? a : b,
      )
      this.space.play('scream', near.position, { gain: 0.9, rate: jitter(0.06), ref: 6 })
      this.sinceScream = 0
    }
    this.fleeing = runners.length
  }
}
