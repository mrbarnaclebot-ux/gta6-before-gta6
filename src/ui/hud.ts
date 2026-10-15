import type { Quality } from '../settings'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

/** HUD: FPS readout (dev builds or ?debug), graphics toggle, health and breath, speedometer, ammo, and crosshair. */
export class Hud {
  fps = 0
  private frames = 0
  private windowStart = performance.now()
  private readonly fpsEl = $('fps')
  private readonly qualityEl = $<HTMLButtonElement>('quality')
  private readonly healthEl = $('health')
  private readonly breathEl = $('breath')
  private readonly underwaterEl = $('underwater')
  private readonly speedoEl = $('speedo')
  private readonly speedEl = $('speed')
  private readonly stallEl = $('stall')
  private readonly promptEl = $('prompt')
  private readonly crosshairEl = $('crosshair')
  private readonly hitmarkEl = $('hitmark')
  private readonly ammoEl = $('ammo')
  private readonly magEl = $('mag')
  private readonly reserveEl = $('reserve')
  private readonly reloadingEl = $('reloading')

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

  /** Speedometer in km/h while driving; null hides it. `warning` replaces the engine notice. */
  setSpeed(kmh: number | null, warning: string | null): void {
    this.speedoEl.hidden = kmh === null
    this.stallEl.hidden = warning === null
    if (warning && this.stallEl.textContent !== warning) this.stallEl.textContent = warning
    const text = String(Math.round(kmh ?? 0))
    if (this.speedEl.textContent !== text) this.speedEl.textContent = text
  }

  /** Pistol readout while on foot; null hides it and the crosshair. */
  setWeapon(
    w: { mag: number; reserve: number; reloading: boolean; raised: boolean; hit: boolean } | null,
  ): void {
    this.ammoEl.hidden = w === null
    this.crosshairEl.hidden = !w?.raised
    if (!w) return
    this.hitmarkEl.hidden = !w.hit
    this.reloadingEl.hidden = !w.reloading
    this.magEl.classList.toggle('empty', w.mag === 0)
    text(this.magEl, String(w.mag))
    text(this.reserveEl, String(w.reserve))
  }

  /** Context hint next to the F key, such as "Get in" beside a car; null hides it. */
  setPrompt(action: string | null): void {
    this.promptEl.hidden = action === null
    const label = this.promptEl.querySelector('span')!
    if (action && label.textContent !== action) label.textContent = action
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

function text(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value
}

function bar(el: HTMLElement, value: number): void {
  el.hidden = value >= 1
  const pct = Math.round(value * 100)
  if (el.getAttribute('aria-valuenow') === String(pct)) return
  el.style.setProperty('--fill', `${pct}%`)
  el.setAttribute('aria-valuenow', String(pct))
}
