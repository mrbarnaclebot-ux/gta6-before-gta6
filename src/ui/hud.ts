import type { Quality } from '../settings'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

/** Corner HUD: FPS readout (dev builds or ?debug) and the Low/High graphics toggle. */
export class Hud {
  fps = 0
  private frames = 0
  private windowStart = performance.now()
  private readonly fpsEl = $('fps')
  private readonly qualityEl = $<HTMLButtonElement>('quality')

  constructor(quality: Quality, onToggle: () => void) {
    $('hud').hidden = false
    this.fpsEl.hidden = !(import.meta.env.DEV || location.search.includes('debug'))
    this.qualityEl.addEventListener('click', (e) => {
      e.stopPropagation()
      onToggle()
    })
    this.setQuality(quality)
  }

  setQuality(q: Quality): void {
    this.qualityEl.textContent = `Graphics: ${q === 'high' ? 'High' : 'Low'}`
  }

  /** Frames counted over half-second wall-clock windows: readable, and immune to zero-length frames. */
  frame(): void {
    this.frames++
    const now = performance.now()
    if (now - this.windowStart < 500) return
    this.fps = (this.frames * 1000) / (now - this.windowStart)
    this.frames = 0
    this.windowStart = now
    if (!this.fpsEl.hidden) this.fpsEl.textContent = `${Math.round(this.fps)} fps`
  }
}
