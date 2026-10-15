import { BINDINGS, type Action } from './bindings'

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

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', (e) => this.onKey(e, true))
    window.addEventListener('keyup', (e) => this.onKey(e, false))
    window.addEventListener('blur', () => this.held.clear())
    window.addEventListener('mousemove', (e) => this.onMouseMove(e))
    target.addEventListener('click', () => this.lockPointer())
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
    // Let Space and Enter activate focused buttons and links; key-ups still release held actions.
    if (down && (e.target as Element).closest?.('button, a, input, select, textarea')) return
    e.preventDefault()
    if (down && !e.repeat) this.pressed.add(action)
    if (down) this.held.add(action)
    else this.held.delete(action)
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.locked && e.buttons === 0) return
    this.lookX += e.movementX
    this.lookY += e.movementY
  }
}
