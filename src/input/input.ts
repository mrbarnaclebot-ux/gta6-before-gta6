import { clamp1, clampLength } from './analog'
import { BINDINGS, MOUSE_BINDINGS, moveAxes, type Action } from './bindings'

/** Which labels the prompts and the Controls screen show: the last device used. */
export type Device = 'keys' | 'pad' | 'touch'
type Source = 'keys' | 'mouse' | 'pad' | 'touch'
/** Analog intent from a stick: x right, z forward, throttle +1 full gas to -1 full brake. */
export type Axes = { x: number; z: number; throttle: number }
export type Context = 'walking' | 'swimming' | 'driving'

const ZERO: Axes = { x: 0, z: 0, throttle: 0 }

export const coarsePointer = () =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/**
 * The action layer: keyboard and mouse here, and the gamepad and touch controls through
 * `hold`, `setAxes`, and `addLook`, all feed the same actions the game reads.
 * Pointer lock is preferred for mouse look, but click-drag also orbits so the game stays
 * playable where lock is refused (headless browsers, iframes, phones).
 */
export class Input {
  readonly held = new Set<Action>()
  /** What the player is doing, set by the game each frame: some pad buttons depend on it. */
  context: Context = 'walking'
  device: Device = coarsePointer() ? 'touch' : 'keys'
  private readonly holds: Record<Source, Set<Action>> = {
    keys: new Set(),
    mouse: new Set(),
    pad: new Set(),
    touch: new Set(),
  }
  private readonly axes = { pad: { ...ZERO }, touch: { ...ZERO } }
  private readonly deviceListeners: ((d: Device) => void)[] = []
  private pressed = new Set<Action>()
  private lookX = 0
  private lookY = 0
  /** This browser grants pointer lock, so a click while unlocked only re-captures the mouse. */
  private everLocked = false

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', (e) => this.onKey(e, true))
    window.addEventListener('keyup', (e) => this.onKey(e, false))
    window.addEventListener('blur', () => this.reset())
    window.addEventListener('mousemove', (e) => this.onMouseMove(e))
    target.addEventListener('click', () => this.lockPointer())
    target.addEventListener('mousedown', (e) => this.onButton(e.button, true))
    // Release anywhere, so letting go over the HUD or outside the window does not stick.
    window.addEventListener('mouseup', (e) => this.onButton(e.button, false))
    target.addEventListener('contextmenu', (e) => e.preventDefault())
    document.addEventListener('pointerlockchange', () => {
      if (this.locked) this.everLocked = true
    })
    // Capture phase, so a finger on any control (menu, HUD button, map) switches the labels.
    const pointer = (e: PointerEvent) =>
      this.use(e.pointerType === 'touch' ? 'touch' : e.pointerType === 'mouse' ? 'keys' : null)
    window.addEventListener('pointerdown', pointer, true)
    document.documentElement.dataset.input = this.device
  }

  /** Must be called from a user gesture such as the Play click. */
  lockPointer(): void {
    if (this.device === 'touch') return
    try {
      const result = this.target.requestPointerLock() as unknown as Promise<void> | undefined
      result?.catch?.(() => {})
    } catch {
      // Lock is optional (and missing on iOS); drag-to-look still works.
    }
  }

  get locked(): boolean {
    return document.pointerLockElement === this.target
  }

  /** This browser grants pointer lock but it is lost: Esc gives no user gesture, so a click must re-capture it. */
  get needsRelock(): boolean {
    return this.everLocked && !this.locked && this.device === 'keys'
  }

  /** True once per press, then cleared. */
  consume(action: Action): boolean {
    return this.pressed.delete(action)
  }

  consumeLook(): { x: number; y: number } {
    const look = { x: this.lookX, y: this.lookY }
    this.lookX = 0
    this.lookY = 0
    return look
  }

  /** A button from any source went down or up. A press counts once until consumed. */
  hold(source: Source, action: Action, down: boolean): void {
    const set = this.holds[source]
    if (down === set.has(action)) return
    if (down) {
      set.add(action)
      this.pressed.add(action)
    } else set.delete(action)
    this.held.clear()
    for (const s of Object.values(this.holds)) for (const a of s) this.held.add(a)
  }

  isHeld(source: Source, action: Action): boolean {
    return this.holds[source].has(action)
  }

  setAxes(source: 'pad' | 'touch', a: Axes): void {
    Object.assign(this.axes[source], a)
  }

  /** Camera turn in mouse pixels, from a stick or a finger drag. */
  addLook(x: number, y: number): void {
    this.lookX += x
    this.lookY += y
  }

  /** Walking or swimming intent in camera space: keys and sticks summed, never past length 1. */
  move(): { x: number; z: number } {
    const k = moveAxes(this.held)
    const { pad, touch } = this.axes
    const v = clampLength(k.x + pad.x + touch.x, k.z + pad.z + touch.z)
    return { x: v.x, z: v.y }
  }

  /** Driving: throttle and steer from -1 to 1 (steer +1 is left), and the handbrake. */
  drive(): { throttle: number; steer: number; handbrake: boolean } {
    const h = this.held
    const { pad, touch } = this.axes
    const keyThrottle = Number(h.has('forward')) - Number(h.has('back'))
    const keySteer = Number(h.has('right')) - Number(h.has('left'))
    return {
      throttle: clamp1(keyThrottle + pad.throttle + touch.throttle),
      steer: -clamp1(keySteer + pad.x + touch.x),
      handbrake: h.has('jump'),
    }
  }

  /** Drop every button and stick of one source, as when a menu takes the gamepad. */
  release(source: 'pad' | 'touch'): void {
    for (const a of [...this.holds[source]]) this.hold(source, a, false)
    this.setAxes(source, ZERO)
  }

  /** The player picked up another device: switch the labels. */
  use(device: Device | null): void {
    if (!device || device === this.device) return
    this.device = device
    document.documentElement.dataset.input = device
    for (const f of this.deviceListeners) f(device)
  }

  onDevice(f: (d: Device) => void): void {
    this.deviceListeners.push(f)
  }

  /** Forget keys and motion from before the game started or a menu closed, such as the Play press. */
  reset(): void {
    for (const s of Object.values(this.holds)) s.clear()
    this.held.clear()
    this.pressed.clear()
    this.setAxes('pad', ZERO)
    this.setAxes('touch', ZERO)
    this.consumeLook()
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    // Synthetic keys (the gamepad's menu Back) must not flip the labels to the keyboard.
    if (e.isTrusted && down) this.use('keys')
    const action = BINDINGS[e.code]
    if (!action) return
    if (!down) return this.hold('keys', action, false)
    // Let Space and Enter activate focused buttons and links: browsers click on key-up.
    // Esc always reaches the game, so it closes the pause menu from any control.
    const control = (e.target as Element).closest?.('button, a, input, select, textarea')
    if (control && action !== 'pause') return
    e.preventDefault()
    this.hold('keys', action, true)
    // Auto-repeat after a reset keeps the key held but is not a new press (Esc would re-pause).
    if (e.repeat) this.pressed.delete(action)
  }

  private onButton(button: number, down: boolean): void {
    const action = MOUSE_BINDINGS[button]
    if (!action) return
    if (!down) return this.hold('mouse', action, false)
    // The click that re-captures the mouse after Esc should not also fire.
    // ponytail: if the browser refuses the re-lock (Chrome's cooldown right after Esc), clicks
    // stay swallowed until a re-lock succeeds; track the re-lock request itself if that bites.
    if (this.everLocked && !this.locked) return
    this.hold('mouse', action, true)
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.locked && e.buttons === 0) return
    this.lookX += e.movementX
    this.lookY += e.movementY
  }
}
