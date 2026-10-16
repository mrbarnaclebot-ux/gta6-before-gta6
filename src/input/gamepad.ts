import type { Action } from './bindings'
import type { Input } from './input'
import { adjust, back, confirm, moveFocus, openScreen } from './pad-menu'
import { PAD, padActions, padAxes } from './pad-map'

// Right stick at full tilt turns the camera as fast as this many mouse pixels a second.
const LOOK_RATE = 1100
// The left stick also steps through menus once pushed this far.
const MENU_STICK = 0.6

/** The first connected pad, preferring the standard layout. getGamepads is missing in some webviews. */
function firstPad(): Gamepad | null {
  let pads: (Gamepad | null)[]
  try {
    pads = [...(navigator.getGamepads?.() ?? [])]
  } catch {
    return null
  }
  const live = pads.filter((p): p is Gamepad => !!p && p.connected !== false)
  return live.find((p) => p.mapping === 'standard') ?? live[0] ?? null
}

/**
 * Polls the Gamepad API once a frame (it has no button events) and feeds the action layer.
 * While a menu or the map is open the pad drives the DOM menus instead. Pads come and go
 * at any time: polling simply finds whatever is connected.
 */
export class Gamepads {
  private last = new Set<number>()
  /** The actions the pad held last frame. */
  private prev = new Set<Action>()
  private stickWas = 0
  private time = 0
  private wasMenu = false
  private connected = false

  constructor(private readonly input: Input) {
    requestAnimationFrame((t) => this.frame(t))
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - this.time) / 1000))
    this.time = now
    const pad = firstPad()
    // Unplugged mid-press: let go of everything it held, sticks included.
    if (!pad && this.connected) this.forget()
    this.connected = pad !== null
    if (pad) this.poll(pad, dt)
    requestAnimationFrame((t) => this.frame(t))
  }

  private forget(): void {
    this.last.clear()
    this.prev.clear()
    this.input.release('pad')
  }

  private poll(pad: Gamepad, dt: number): void {
    const value = (b: number) => pad.buttons[b]?.value ?? 0
    const down = new Set<number>()
    pad.buttons.forEach((b, i) => (b.pressed || b.value > 0.5) && down.add(i))
    const pressed = [...down].filter((b) => !this.last.has(b))
    this.last = down
    const { drive, look } = padAxes(pad.axes, value)
    if (pressed.length || drive.x || drive.z || look.x || look.y) this.input.use('pad')
    const actions = padActions(value, this.input.context)
    const screen = openScreen()
    if (screen) {
      if (!this.wasMenu) this.input.release('pad')
      this.wasMenu = true
      // Buttons held over a menu (A on Resume) must not act in game once it closes.
      this.prev = actions
      return this.menu(screen, pressed, drive.z)
    }
    this.wasMenu = false
    this.buttons(actions)
    this.input.setAxes('pad', drive)
    this.input.addLook(look.x * LOOK_RATE * dt, look.y * LOOK_RATE * dt)
  }

  /** Holds and releases only on change, so a reset (a menu closing) is not undone by a held button. */
  private buttons(now: Set<Action>): void {
    for (const a of now) if (!this.prev.has(a)) this.input.hold('pad', a, true)
    for (const a of this.prev) if (!now.has(a)) this.input.hold('pad', a, false)
    this.prev = now
  }

  private menu(screen: HTMLElement, pressed: number[], stickZ: number): void {
    const stick = stickZ > MENU_STICK ? -1 : stickZ < -MENU_STICK ? 1 : 0
    if (stick && stick !== this.stickWas) moveFocus(screen, stick as 1 | -1)
    this.stickWas = stick
    for (const b of pressed) {
      if (b === PAD.UP) moveFocus(screen, -1)
      else if (b === PAD.DOWN) moveFocus(screen, 1)
      else if (b === PAD.LEFT) adjust(-1)
      else if (b === PAD.RIGHT) adjust(1)
      else if (b === PAD.A) confirm(screen)
      else if (b === PAD.B) back()
      else if (b === PAD.START) this.start(screen)
      else if (b === PAD.BACK && screen.id === 'worldmap') this.tap('map')
    }
  }

  private tap(a: Action): void {
    this.input.hold('pad', a, true)
    this.input.hold('pad', a, false)
  }

  /** Start closes the pause menu in game (as it opened it); on the title screen it confirms. */
  private start(screen: HTMLElement): void {
    if (screen.id === 'menu') confirm(screen)
    else back()
  }
}
