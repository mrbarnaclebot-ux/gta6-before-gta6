/**
 * Footfalls from the animation itself: each foot's height above the body is fed in every
 * frame, and a step is called as a foot sinks through the bottom of its swing. Adapts to
 * any rig and any clip speed. Pure.
 */
export class StepDetector {
  private readonly prev: number[] = []
  private readonly lo: number[] = []
  private readonly hi: number[] = []
  private readonly since: number[] = []

  /** Returns the index of the foot that just came down, or -1. */
  update(heights: number[], dt: number): number {
    let planted = -1
    heights.forEach((h, i) => {
      const prev = this.prev[i] ?? h
      this.since[i] = (this.since[i] ?? 1) + dt
      // The swing's range relaxes slowly toward the current height, so a new clip re-learns it.
      const relax = Math.min(1, 0.5 * dt)
      this.lo[i] = Math.min(h, (this.lo[i] ?? h) + (h - (this.lo[i] ?? h)) * relax)
      this.hi[i] = Math.max(h, (this.hi[i] ?? h) + (h - (this.hi[i] ?? h)) * relax)
      const range = this.hi[i] - this.lo[i]
      const floor = this.lo[i] + range * 0.3
      if (range > 0.04 && prev > floor && h <= floor && this.since[i] > 0.2) {
        this.since[i] = 0
        planted = i
      }
      this.prev[i] = h
    })
    return planted
  }

  /** Forget the swing: after a jump, a swim, or a cutscene. */
  reset(): void {
    this.prev.length = this.lo.length = this.hi.length = this.since.length = 0
  }
}
