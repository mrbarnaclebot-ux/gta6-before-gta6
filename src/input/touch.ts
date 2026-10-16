import { shape, thumbstick, type Vec } from './analog'
import type { Action } from './bindings'
import type { Context, Input } from './input'

// Full stick deflection, in CSS pixels from where the thumb landed.
const STICK_RADIUS = 56
// A finger drag turns the camera this many times a mouse move of the same length.
const TOUCH_LOOK = 1.5
// Touch has no physical rest position to wobble about, so a small deadzone and a gentle curve.
const STICK_DEADZONE = 0.08
const STICK_CURVE = 1.2

type Kind = 'hold' | 'toggle' | 'tap'
/** One on-screen button: its action, label, the contexts it shows in, and where it sits. */
interface ButtonSpec {
  action: Action
  label: string
  on: Context[]
  kind: Kind
  /** Offsets from the bottom-right safe corner, and the diameter, in px. */
  at: [right: number, bottom: number, size: number]
  /** Dragging from this button also turns the camera (fire and aim, as in most shooters). */
  look?: boolean
}

const BIG = 76
const SMALL = 56
const C1 = 88
const C2 = 156
const R1 = 72

export const BUTTONS: ButtonSpec[] = [
  { action: 'fire', label: 'Fire', on: ['walking'], kind: 'hold', at: [0, 0, BIG], look: true },
  { action: 'aim', label: 'Aim', on: ['walking'], kind: 'toggle', at: [10, 88, SMALL], look: true },
  { action: 'jump', label: 'Jump', on: ['walking'], kind: 'hold', at: [C1, 0, SMALL] },
  { action: 'run', label: 'Run', on: ['walking'], kind: 'toggle', at: [C1, R1, SMALL] },
  { action: 'reload', label: 'Reload', on: ['walking'], kind: 'tap', at: [C2, 0, SMALL] },
  { action: 'use', label: 'Use', on: ['walking'], kind: 'tap', at: [C2, R1, SMALL] },
  { action: 'jump', label: 'Brake', on: ['driving'], kind: 'hold', at: [0, 0, BIG] },
  { action: 'horn', label: 'Horn', on: ['driving'], kind: 'hold', at: [C1, 0, SMALL] },
  { action: 'use', label: 'Exit', on: ['driving'], kind: 'tap', at: [10, 88, SMALL] },
  { action: 'dive', label: 'Dive', on: ['swimming'], kind: 'hold', at: [0, 0, BIG] },
  { action: 'jump', label: 'Climb', on: ['swimming'], kind: 'hold', at: [C1, 0, SMALL] },
  { action: 'use', label: 'Use', on: ['swimming'], kind: 'tap', at: [C1, R1, SMALL] },
]

const PAUSE_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement) {
  const e = document.createElement(tag)
  e.className = cls
  parent.append(e)
  return e
}

/**
 * Phone and tablet controls over the canvas: a floating thumbstick on the left half, drag to
 * look on the right half, and context buttons. Every finger is its own pointer, so moving,
 * looking, and firing work at once.
 */
export class TouchControls {
  readonly root = el('div', 'touch', document.body)
  private readonly base: HTMLElement
  private readonly knob: HTMLElement
  private readonly uses: HTMLElement[] = []
  private readonly toggles: [HTMLElement, Action][] = []
  private stick: { id: number; origin: Vec } | null = null
  private readonly looks = new Map<number, Vec>()

  constructor(private readonly input: Input) {
    this.root.hidden = true
    this.root.setAttribute('aria-hidden', 'true')
    const pad = el('div', 'touch-zone touch-move', this.root)
    const look = el('div', 'touch-zone touch-look', this.root)
    this.base = el('div', 'stick', this.root)
    this.knob = el('div', 'stick-knob', this.base)
    this.wireStick(pad)
    this.wireLook(look)
    for (const spec of BUTTONS) this.button(spec)
    this.topButton('map', 'Map', 'tb-map')
    this.topButton('pause', PAUSE_ICON, 'tb-pause')
    // No page scroll, pinch, double-tap zoom, or long-press callout from the controls.
    this.root.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
    this.root.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  /** Per frame: show the controls for `mode`, or hide them all (menus, map, death). */
  update(show: boolean, mode: Context, prompt: string | null): void {
    const visible = show && this.input.device === 'touch'
    if (this.root.hidden === visible) {
      this.root.hidden = !visible
      if (!visible) this.lift()
    }
    if (!visible) return
    if (this.root.dataset.mode !== mode) {
      this.root.dataset.mode = mode
      this.input.release('touch')
    }
    for (const u of this.uses) {
      const label = mode === 'driving' ? 'Exit' : (prompt ?? 'Use')
      if (u.textContent !== label) u.textContent = label
      u.classList.toggle('ready', prompt !== null)
    }
    for (const [b, a] of this.toggles) b.classList.toggle('on', this.input.isHeld('touch', a))
  }

  /** Every finger up: nothing stays held when the controls hide under a menu. */
  private lift(): void {
    this.stick = null
    this.looks.clear()
    this.base.classList.remove('live')
    this.knob.style.transform = ''
    this.input.release('touch')
  }

  private wireStick(zone: HTMLElement): void {
    // A new thumb on the left half always takes the stick, so a lost pointerup cannot jam it.
    zone.addEventListener('pointerdown', (e) => {
      zone.setPointerCapture?.(e.pointerId)
      const r = STICK_RADIUS + 8
      const origin = { x: Math.max(r, e.clientX), y: Math.min(innerHeight - r, e.clientY) }
      this.stick = { id: e.pointerId, origin }
      this.base.style.left = `${origin.x}px`
      this.base.style.top = `${origin.y}px`
      this.base.classList.add('live')
      this.moveStick(e)
    })
    zone.addEventListener('pointermove', (e) => this.moveStick(e))
    const end = (e: PointerEvent) => {
      if (this.stick?.id !== e.pointerId) return
      this.stick = null
      this.base.classList.remove('live')
      this.base.style.left = this.base.style.top = this.knob.style.transform = ''
      this.input.setAxes('touch', { x: 0, z: 0, throttle: 0 })
    }
    zone.addEventListener('pointerup', end)
    zone.addEventListener('pointercancel', end)
  }

  private moveStick(e: PointerEvent): void {
    if (this.stick?.id !== e.pointerId) return
    const { knob, value } = thumbstick(
      this.stick.origin,
      { x: e.clientX, y: e.clientY },
      STICK_RADIUS,
    )
    this.knob.style.transform = `translate(${knob.x}px, ${knob.y}px)`
    const v = shape(value, STICK_DEADZONE, STICK_CURVE)
    // Screen up is forward on foot and the throttle in a car; down is back and the brake.
    this.input.setAxes('touch', { x: v.x, z: -v.y, throttle: -v.y })
  }

  /** Drag anywhere on the right half (or from a look button) to turn the camera. */
  private wireLook(zone: HTMLElement): void {
    zone.addEventListener('pointerdown', (e) => {
      zone.setPointerCapture?.(e.pointerId)
      this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY })
    })
    zone.addEventListener('pointermove', (e) => this.drag(e))
    const end = (e: PointerEvent) => this.looks.delete(e.pointerId)
    zone.addEventListener('pointerup', end)
    zone.addEventListener('pointercancel', end)
  }

  private drag(e: PointerEvent): void {
    const last = this.looks.get(e.pointerId)
    if (!last) return
    this.input.addLook((e.clientX - last.x) * TOUCH_LOOK, (e.clientY - last.y) * TOUCH_LOOK)
    this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  private button(spec: ButtonSpec): void {
    const b = el('button', `tb tb-${spec.kind}`, this.root)
    b.type = 'button'
    b.tabIndex = -1
    b.textContent = spec.label
    b.dataset.action = spec.action
    b.dataset.on = spec.on.join(' ')
    const [right, bottom, size] = spec.at
    b.style.cssText = `--r:${right}px;--b:${bottom}px;--s:${size}px`
    if (spec.action === 'use') this.uses.push(b)
    if (spec.kind === 'toggle') this.toggles.push([b, spec.action])
    this.press(b, spec)
  }

  private press(b: HTMLElement, spec: ButtonSpec): void {
    const { input } = this
    b.addEventListener('pointerdown', (e) => {
      b.setPointerCapture?.(e.pointerId)
      b.classList.add('down')
      if (spec.look) this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (spec.kind === 'toggle')
        input.hold('touch', spec.action, !input.isHeld('touch', spec.action))
      else input.hold('touch', spec.action, true)
      if (spec.kind === 'tap') input.hold('touch', spec.action, false)
    })
    if (spec.look) b.addEventListener('pointermove', (e) => this.drag(e))
    const end = (e: PointerEvent) => {
      b.classList.remove('down')
      this.looks.delete(e.pointerId)
      if (spec.kind === 'hold') input.hold('touch', spec.action, false)
    }
    b.addEventListener('pointerup', end)
    b.addEventListener('pointercancel', end)
  }

  private topButton(action: Action, html: string, cls: string): void {
    const b = el('button', `tb tb-top ${cls}`, this.root)
    b.type = 'button'
    b.tabIndex = -1
    b.innerHTML = html
    b.setAttribute('aria-label', action === 'map' ? 'Map' : 'Pause')
    b.dataset.action = action
    b.addEventListener('pointerdown', () => {
      this.input.hold('touch', action, true)
      this.input.hold('touch', action, false)
    })
  }
}
