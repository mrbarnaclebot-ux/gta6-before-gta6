const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

/** HUD: FPS readout (the Show FPS setting), wanted stars, health and breath, speedometer, ammo, crosshair, and the death screen. */
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
  private readonly stallEl = $('stall')
  private readonly promptEl = $('prompt')
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
