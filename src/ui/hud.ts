import type { Quality } from '../settings'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

/** HUD: FPS readout (dev builds or ?debug), the Low/High graphics toggle, health and breath bars. */
export class Hud {
  fps = 0
  private frames = 0
  private windowStart = performance.now()
  private readonly fpsEl = $('fps')
  private readonly qualityEl = $<HTMLButtonElement>('quality')
  private readonly healthEl = $('health')
  private readonly breathEl = $('breath')
  private readonly underwaterEl = $('underwater')

  constructor(quality: Quality, onToggle: () => void) {
    $('hud').hidden = false
    this.fpsEl.hidden = !(import.meta.env.DEV || location.search.includes('debug'))
    this.qualityEl.addEventListener('click', (e) => {
      e.stopPropagation()
      // Hand the keyboard back to the game; game keys ignore a focused button.
      this.qualityEl.blur()
      onToggle()
    })
    this.setQuality(quality)
  }

  setQuality(q: Quality): void {
    this.qualityEl.textContent = `Graphics: ${q === 'high' ? 'High' : 'Low'}`
  }

  /** Bars appear only while not full, like most open-world HUDs. Values are 0 to 1. */
  setVitals(health: number, breath: number): void {
    bar(this.healthEl, health)
    bar(this.breathEl, breath)
  }

  setUnderwater(on: boolean): void {
    this.underwaterEl.hidden = !on
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

function bar(el: HTMLElement, value: number): void {
  el.hidden = value >= 1
  const pct = Math.round(value * 100)
  if (el.getAttribute('aria-valuenow') === String(pct)) return
  el.style.setProperty('--fill', `${pct}%`)
  el.setAttribute('aria-valuenow', String(pct))
}
