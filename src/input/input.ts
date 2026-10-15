import { BINDINGS, MOUSE_BINDINGS, type Action } from './bindings'

/**
 * Keyboard and mouse state. Pointer lock is preferred for mouse look, but
 * click-drag also orbits so the game stays playable where lock is refused
 * (headless browsers, iframes, some Linux setups).
 */
export class Input {
  readonly held = new Set<Action>()
  private pressed = new Set<Action>()
  private lookX = 0
  private lookY = 0
  /** This browser grants pointer lock, so a click while unlocked only re-captures the mouse. */
  private everLocked = false

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', (e) => this.onKey(e, true))
    window.addEventListener('keyup', (e) => this.onKey(e, false))
    window.addEventListener('blur', () => this.held.clear())
    window.addEventListener('mousemove', (e) => this.onMouseMove(e))
    target.addEventListener('click', () => this.lockPointer())
    target.addEventListener('mousedown', (e) => this.onButton(e.button, true))
    // Release anywhere, so letting go over the HUD or outside the window does not stick.
    window.addEventListener('mouseup', (e) => this.onButton(e.button, false))
    target.addEventListener('contextmenu', (e) => e.preventDefault())
    document.addEventListener('pointerlockchange', () => {
      if (this.locked) this.everLocked = true
    })
  }

  /** Must be called from a user gesture such as the Play click. */
  lockPointer(): void {
    try {
      const result = this.target.requestPointerLock() as unknown as Promise<void> | undefined
      result?.catch?.(() => {})
    } catch {
      // Lock is optional; drag-to-look still works.
    }
  }

  get locked(): boolean {
    return document.pointerLockElement === this.target
  }

  /** True once per key press, then cleared. */
  consume(action: Action): boolean {
    return this.pressed.delete(action)
  }

  consumeLook(): { x: number; y: number } {
    const look = { x: this.lookX, y: this.lookY }
    this.lookX = 0
    this.lookY = 0
    return look
  }

  /** Forget keys and mouse motion from before the game started, such as the Play key press. */
  reset(): void {
    this.held.clear()
    this.pressed.clear()
    this.consumeLook()
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const action = BINDINGS[e.code]
    if (!action) return
    if (!down) this.held.delete(action)
    // Let Space and Enter activate focused buttons and links: browsers click on key-up.
    // Esc always reaches the game, so it closes the pause menu from any control.
    const control = (e.target as Element).closest?.('button, a, input, select, textarea')
    if (control && action !== 'pause') return
    e.preventDefault()
    if (down && !e.repeat) this.pressed.add(action)
    if (down) this.held.add(action)
  }

  private onButton(button: number, down: boolean): void {
    const action = MOUSE_BINDINGS[button]
    if (!action) return
    if (!down) return void this.held.delete(action)
    // The click that re-captures the mouse after Esc should not also fire.
    // ponytail: if the browser refuses the re-lock (Chrome's cooldown right after Esc), clicks
    // stay swallowed until a re-lock succeeds; track the re-lock request itself if that bites.
    if (this.everLocked && !this.locked) return
    this.pressed.add(action)
    this.held.add(action)
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.locked && e.buttons === 0) return
    this.lookX += e.movementX
    this.lookY += e.movementY
  }
}
