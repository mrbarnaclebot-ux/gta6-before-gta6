const WINDOW = 1
// With vsync a frame rate between these means frames already miss the 60 Hz deadline.
const LOW_FPS = 58
const HIGH_FPS = 59.5
const STEP_DOWN = 0.1
const STEP_UP = 0.05
const MIN_SCALE = 0.5
// After a drop, hold this many windows before trying higher again, so it does not hunt.
// Each drop right after a climb doubles the hold, up to MAX_HOLD: the scale settles.
const HOLD = 3
const MAX_HOLD = 30

/**
 * Picks a render scale that holds about 60 fps: measures each second, drops fast when
 * slow, climbs slowly back toward `max` (the render scale setting) when there is room.
 */
export class DynamicRes {
  scale: number
  private time = 0
  private frames = 0
  private hold = 0
  private holdFor = HOLD
  private climbed = false

  constructor(private max: number) {
    this.scale = max
  }

  reset(max: number): void {
    this.max = this.scale = max
    this.time = this.frames = this.hold = 0
    this.holdFor = HOLD
    this.climbed = false
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
      this.holdFor = this.climbed ? Math.min(MAX_HOLD, this.holdFor * 2) : this.holdFor
      this.hold = this.holdFor
      this.climbed = false
    } else if (this.hold > 0) this.hold--
    else if (fps > HIGH_FPS && this.scale < this.max) {
      this.scale = Math.min(this.max, this.scale + STEP_UP)
      this.climbed = true
    }
    return this.scale
  }
}
