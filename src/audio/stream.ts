import type { Mixer } from './mixer'

/**
 * A song streamed by an audio element into the music bus, so a three-minute track is never
 * downloaded or decoded whole before it plays. Fades by gain; pauses once faded out.
 * ponytail: an element's own `loop` can leave a few ms of gap at the seam of the menu and chase
 * loops; decode those two into buffers (about 30 MB of memory) if the gap is ever audible.
 */
export class Stream {
  readonly el = new Audio()
  private gain: GainNode | null = null
  private level = 0
  private pauseTimer = 0

  constructor(private readonly mixer: Mixer) {
    this.el.preload = 'none'
  }

  get src(): string {
    return this.el.getAttribute('src') ?? ''
  }

  /** Sets the file (a no-op if it is already this one) without starting it. */
  load(url: string, loop: boolean): void {
    this.el.loop = loop
    if (this.src !== url) this.el.setAttribute('src', url)
  }

  /** Starts or continues playing, fading to `level` over `seconds`. */
  fadeTo(level: number, seconds: number): void {
    const g = this.mixer.graph
    if (!g) return
    if (!this.gain) {
      this.gain = g.ctx.createGain()
      this.gain.gain.value = 0
      g.ctx.createMediaElementSource(this.el).connect(this.gain).connect(g.buses.music)
    }
    const p = this.gain.gain
    const t = g.ctx.currentTime
    p.cancelScheduledValues(t)
    p.setValueAtTime(p.value, t)
    p.linearRampToValueAtTime(level, t + Math.max(0.01, seconds))
    this.level = level
    clearTimeout(this.pauseTimer)
    if (level > 0) {
      if (this.el.paused && this.src) this.el.play().catch(() => {})
    } else {
      this.pauseTimer = window.setTimeout(() => this.el.pause(), seconds * 1000 + 50)
    }
  }

  /** Heard at all right now (fading in or playing). */
  get on(): boolean {
    return this.level > 0 && !this.el.paused
  }
}
