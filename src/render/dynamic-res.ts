const WINDOW = 1
const LOW_FPS = 55
const HIGH_FPS = 58.5
const STEP_DOWN = 0.1
const STEP_UP = 0.05
const MIN_SCALE = 0.5
// After a drop, hold this many windows before trying higher again, so it does not hunt.
const HOLD = 3

/**
 * Picks a render scale that holds about 60 fps: measures each second, drops fast when
 * slow, climbs slowly back toward `max` (the render scale setting) when there is room.
 */
export class DynamicRes {
  scale: number
  private time = 0
  private frames = 0
  private hold = 0

  constructor(private max: number) {
    this.scale = max
  }

  reset(max: number): void {
    this.max = this.scale = max
    this.time = this.frames = this.hold = 0
  }

  /** Feed each frame's length; returns the scale to render at. */
  update(dt: number): number {
    this.time += dt
    this.frames++
    if (this.time < WINDOW) return this.scale
    const fps = this.frames / this.time
    this.time = this.frames = 0
    if (fps < LOW_FPS) {
      this.scale = Math.max(MIN_SCALE, this.scale - STEP_DOWN)
      this.hold = HOLD
    } else if (this.hold > 0) this.hold--
    else if (fps > HIGH_FPS) this.scale = Math.min(this.max, this.scale + STEP_UP)
    return this.scale
  }
}
