export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'run'
  | 'jump'
  | 'dive'
  | 'use'
  | 'fire'
  | 'aim'
  | 'reload'
  | 'pause'
  | 'map'
  | 'horn'
  | 'radioNext'
  | 'radioPrev'

// KeyboardEvent.code, so WASD stays in place on AZERTY and other layouts.
export const BINDINGS: Readonly<Record<string, Action>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Space: 'jump',
  ControlLeft: 'dive',
  ControlRight: 'dive',
  // Ctrl+W closes the tab on Windows and Linux and pages cannot block it, so C dives too.
  KeyC: 'dive',
  KeyF: 'use',
  KeyR: 'reload',
  Escape: 'pause',
  KeyM: 'map',
  KeyH: 'horn',
  KeyE: 'radioNext',
  KeyQ: 'radioPrev',
}

/** MouseEvent.button: left fires, right aims. */
export const MOUSE_BINDINGS: Readonly<Record<number, Action>> = { 0: 'fire', 2: 'aim' }

/** Movement intent in camera space: x is right, z is forward. Diagonals are not faster. */
export function moveAxes(held: ReadonlySet<Action>): { x: number; z: number } {
  const x = Number(held.has('right')) - Number(held.has('left'))
  const z = Number(held.has('forward')) - Number(held.has('back'))
  const len = Math.hypot(x, z)
  return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 }
}
