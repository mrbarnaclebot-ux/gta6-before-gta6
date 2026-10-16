const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// Where the speedometer ring is full: 220 km/h in a car, 50 knots in a boat.
const DIAL_MAX = { 'km/h': 220, kn: 50 }
/** m/s to the speedometer's unit. */
const PER_MS = { 'km/h': 3.6, kn: 1.944 }
export type SpeedUnit = keyof typeof DIAL_MAX
// How long a help toast stays, in ms; matches the toast-life animation in hud-panels.css.
const TOAST_MS = 6000

/** HUD: FPS readout (the Show FPS setting), wanted stars, health and breath, speedometer, ammo, crosshair, help toasts, and the death screen. */
export class Hud {
  fps = 0
  private frames = 0
  private windowStart = performance.now()
  private readonly fpsEl = $('fps')
  private readonly wantedEl = $('wanted')
  private readonly stars = [...this.wantedEl.children] as HTMLElement[]
  private readonly deathEl = $('death')
  private readonly deathWhere = $('death-where')
  private readonly healthEl = $('health')
  private readonly breathEl = $('breath')
  private readonly underwaterEl = $('underwater')
  private readonly speedoEl = $('speedo')
  private readonly speedEl = $('speed')
  private readonly arcEl = $('speed-arc')
  private readonly unitEl = $('speed-unit')
  private readonly toastsEl = $('toasts')
  private readonly stallEl = $('stall')
  private readonly promptEl = $('prompt')
  private readonly lookHintEl = $('look-hint')
  private readonly crosshairEl = $('crosshair')
  private readonly hitmarkEl = $('hitmark')
  private readonly ammoEl = $('ammo')
  private readonly magEl = $('mag')
  private readonly reserveEl = $('reserve')
  private readonly reloadingEl = $('reloading')

  constructor() {
    $('hud').hidden = false
    $('corner').hidden = false
  }

  setFpsVisible(on: boolean): void {
    this.fpsEl.hidden = !on
  }

  /** Five stars, hidden at zero. They blink while the player is out of sight and they cool. */
  setWanted(level: number, cooling: boolean): void {
    this.wantedEl.hidden = level === 0
    this.wantedEl.classList.toggle('cooling', cooling)
    this.stars.forEach((s, i) => s.classList.toggle('on', i < level))
    const label = `Wanted level ${level} of 5`
    if (this.wantedEl.getAttribute('aria-label') !== label)
      this.wantedEl.setAttribute('aria-label', label)
  }

  /** The death screen naming the hospital the player will wake up at; null hides it. */
  setDeath(hospital: string | null): void {
    this.deathEl.hidden = hospital === null
    if (hospital) text(this.deathWhere, `Waking up at ${hospital}`)
  }

  /** Values are 0 to 1. Health pulses red when low. */
  setVitals(health: number, breath: number): void {
    bar(this.healthEl, health)
    bar(this.breathEl, breath)
    this.healthEl.classList.toggle('low', health < 0.25)
  }

  /** A short help line top left that fades on its own. */
  toast(message: string): void {
    const el = document.createElement('p')
    el.className = 'toast'
    el.textContent = message
    this.toastsEl.append(el)
    window.setTimeout(() => el.remove(), TOAST_MS)
  }

  setUnderwater(on: boolean): void {
    this.underwaterEl.hidden = !on
  }

  /**
   * Speedometer while driving, from m/s: km/h in a car, knots in a boat; null hides it.
   * `warning` replaces the engine notice.
   */
  setSpeed(ms: number | null, warning: string | null, unit: SpeedUnit = 'km/h'): void {
    this.speedoEl.hidden = ms === null
    this.stallEl.hidden = warning === null
    if (warning && this.stallEl.textContent !== warning) this.stallEl.textContent = warning
    if (this.unitEl.textContent !== unit) this.unitEl.textContent = unit
    const value = (ms ?? 0) * PER_MS[unit]
    const text = String(Math.round(value))
    if (this.speedEl.textContent === text) return
    this.speedEl.textContent = text
    // The ring is three quarters of a circle (75 of its 100 path units), open at the bottom.
    this.arcEl.style.strokeDasharray = `${Math.min(1, value / DIAL_MAX[unit]) * 75} 100`
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

  /** Context hint next to its key (F, or Y on a pad), such as "Get in" beside a car; null hides it. */
  setPrompt(action: string | null, key: string): void {
    this.promptEl.hidden = action === null
    const label = this.promptEl.querySelector('span')!
    if (action && label.textContent !== action) label.textContent = action
    text(this.promptEl.querySelector('kbd')!, key)
  }

  /** "Click to look around", while the mouse waits to be captured again. */
  setLookHint(on: boolean): void {
    if (this.lookHintEl.hidden === on) this.lookHintEl.hidden = !on
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
  const pct = Math.round(value * 100)
  if (el.getAttribute('aria-valuenow') === String(pct)) return
  el.style.setProperty('--fill', `${pct}%`)
  el.setAttribute('aria-valuenow', String(pct))
}
