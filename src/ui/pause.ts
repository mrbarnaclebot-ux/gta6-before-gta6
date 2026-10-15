import { SENSITIVITY_RANGE, type Quality } from '../settings'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// A lost pointer lock and the Esc key-down can both arrive for one Esc press.
const DEBOUNCE_MS = 100

interface PauseOptions {
  quality: Quality
  sensitivity: number
  onQuality: () => void
  onSensitivity: (value: number) => void
  /** `fromClick`: the Resume click is a user gesture, so the game can re-lock the mouse. */
  onResume: (fromClick: boolean) => void
}

/** Esc menu: resume, mouse sensitivity, graphics quality, and the controls list. */
export class PauseMenu {
  open = false
  private openedAt = 0
  private readonly root = $('pause')
  private readonly resume = $<HTMLButtonElement>('resume')
  private readonly quality = $<HTMLButtonElement>('quality')
  private readonly slider = $<HTMLInputElement>('sensitivity')
  private readonly readout = $<HTMLOutputElement>('sensitivity-value')

  constructor(private readonly o: PauseOptions) {
    Object.assign(this.slider, {
      min: String(SENSITIVITY_RANGE.min),
      max: String(SENSITIVITY_RANGE.max),
      step: String(SENSITIVITY_RANGE.step),
      value: String(o.sensitivity),
    })
    this.showSensitivity(o.sensitivity)
    this.setQuality(o.quality)
    this.slider.addEventListener('input', () => {
      const v = Number(this.slider.value)
      this.showSensitivity(v)
      o.onSensitivity(v)
    })
    this.quality.addEventListener('click', () => o.onQuality())
    this.resume.addEventListener('click', () => this.hide(true))
    // Losing the mouse (Esc in a locked browser, or switching windows) pauses the game.
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && !this.open) this.show()
    })
  }

  setQuality(q: Quality): void {
    this.quality.textContent = q === 'high' ? 'High' : 'Low'
    this.quality.setAttribute('aria-label', `Graphics quality: ${q}. Click to switch.`)
  }

  /** Esc: open, or close if it has been open a moment. */
  toggle(): void {
    if (!this.open) return this.show()
    if (performance.now() - this.openedAt > DEBOUNCE_MS) this.hide(false)
  }

  show(): void {
    this.open = true
    this.openedAt = performance.now()
    this.root.hidden = false
    this.resume.focus()
  }

  private hide(fromClick: boolean): void {
    this.open = false
    this.root.hidden = true
    this.resume.blur()
    this.o.onResume(fromClick)
  }

  private showSensitivity(v: number): void {
    this.readout.value = `${v.toFixed(1)}x`
  }
}
