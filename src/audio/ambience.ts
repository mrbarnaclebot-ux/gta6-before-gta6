import { SEA_LEVEL } from '../city/layout'
import type { World } from '../game'
import { forestAt } from '../land/districts'
import { coastX } from '../land/shape'
import { bedWeights, BEDS, type Bed } from './ambience-mix'
import { Loop } from './loop'
import type { Mixer } from './mixer'

const LEVEL = 0.85

/**
 * The background beds, crossfaded over a couple of seconds as the player moves between
 * districts and the day turns to night. Each loads the first time it is heard and is freed
 * again after half a minute of silence.
 */
export class Ambience {
  private readonly loops: Record<Bed, Loop>
  /** Kept for the test hook: the last weights. */
  weights: Record<Bed, number> | null = null

  constructor(
    mixer: Mixer,
    private readonly w: World,
    private readonly marina: { x: number; z: number },
  ) {
    const loop = (bed: Bed) =>
      new Loop(mixer, `amb-${bed}`, 'ambience', { unload: true, idleStop: 30 })
    this.loops = Object.fromEntries(BEDS.map((b) => [b, loop(b)])) as Record<Bed, Loop>
  }

  update(dt: number): void {
    const p = this.w.camera.position
    const weights = bedWeights({
      inland: coastX(this.w.city.layout.frame, p.z) - p.x,
      marina: Math.hypot(p.x - this.marina.x, p.z - this.marina.z),
      height: p.y - SEA_LEVEL,
      forest: forestAt(p.x, p.z),
      night: this.w.sky.ambient.night,
      underwater: this.w.city.underwater,
    })
    // Going under is instant; the land beds glide.
    const glide = this.w.city.underwater ? 0.15 : 1.2
    for (const bed of BEDS) this.loops[bed].set(weights[bed] * LEVEL, 1, dt, glide)
    this.weights = weights
  }
}
