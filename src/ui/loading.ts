import { LoadProgress, type Step } from './load-progress'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const SLIDE_MS = 6500
const TIP_MS = 5500
// Matches the .loading.done opacity transition.
const FADE_MS = 700

const TIPS = [
  'Walk up to a parked car and press F to get in. Press F again to get out.',
  'Hold the right mouse button to aim and click to fire. R reloads.',
  'Press M for the map. Click anywhere on it to set a waypoint, and the minimap shows the way.',
  'Esc pauses the game and opens the settings.',
  'Shift runs. In the water, Ctrl or C dives and Space comes back up.',
  'Gunfire draws the police. Leave the red search area and the stars cool off.',
  'Space is the handbrake: tap it to swing the tail through a tight corner.',
]

/** The screen between Play and the first frame: slideshow, rotating tips, and the progress bar. */
export class Loading {
  readonly progress = new LoadProgress()
  private readonly root = $('loading')
  private readonly slides = [...this.root.querySelectorAll('img')]
  private readonly bar = $('load-bar')
  private readonly timers: number[] = []
  private slide = 0
  private tip = Math.floor(Math.random() * TIPS.length)

  /** Resolves once the first slide has decoded, so the screen never appears blank. */
  async show(): Promise<void> {
    this.root.classList.remove('done')
    await load(this.slides[0]).catch(() => {})
    this.root.hidden = false
    this.slides[0].classList.add('on')
    void load(this.slides[1]).catch(() => {})
    this.showTip()
    this.paint()
    this.timers.push(
      window.setInterval(() => this.nextSlide(), SLIDE_MS),
      window.setInterval(() => this.showTip(), TIP_MS),
    )
  }

  finish(step: Step): void {
    this.progress.finish(step)
    this.paint()
  }

  files(loaded: number, total: number): void {
    this.progress.files(loaded, total)
    this.paint()
  }

  /** The first frame is on screen: fill the bar and fade out over it. */
  ready(): void {
    this.finish('shaders')
    this.root.classList.add('done')
    window.setTimeout(() => this.close(), FADE_MS)
  }

  close(): void {
    this.timers.forEach(clearInterval)
    this.timers.length = 0
    this.root.hidden = true
  }

  private paint(): void {
    const pct = Math.round(this.progress.value * 100)
    this.bar.style.setProperty('--p', String(pct / 100))
    this.bar.setAttribute('aria-valuenow', String(pct))
    $('load-pct').textContent = `${pct}%`
    $('load-status').textContent = this.progress.status
  }

  private nextSlide(): void {
    const n = this.slides.length
    this.slides[this.slide].classList.remove('on')
    this.slide = (this.slide + 1) % n
    this.slides[this.slide].classList.add('on')
    // Fetch one slide ahead, so a crossfade never lands on an image still downloading.
    void load(this.slides[(this.slide + 1) % n]).catch(() => {})
  }

  private showTip(): void {
    const p = $('tip')
    p.textContent = TIPS[this.tip++ % TIPS.length]
    // Restart the fade-in animation for the new text.
    p.style.animation = 'none'
    void p.offsetWidth
    p.style.animation = ''
  }
}

function load(img: HTMLImageElement): Promise<void> {
  if (!img.src) img.src = img.dataset.src!
  return img.decode()
}
