import type { Device } from '../input/input'

/** The key cap beside a prompt such as "Get in"; touch shows the word on its own button instead. */
export const PROMPT_KEY: Record<Device, string> = { keys: 'F', pad: 'Y', touch: '' }

type PerDevice = Record<Device, string>

/** First-time help toasts, worded for the device in hand. Pad buttons are plain text in brackets. */
export const TIPS: Record<string, PerDevice> = {
  map: {
    keys: 'Press M for the map. Click on it to set a waypoint.',
    pad: 'Press [Back] for the map. [B] closes it.',
    touch: 'Tap Map for the map, then tap it to set a waypoint.',
  },
  car: {
    keys: 'Walk up to a parked car and press F to get in.',
    pad: 'Walk up to a parked car and press [Y] to get in.',
    touch: 'Walk up to a parked car and tap Get in.',
  },
  boat: {
    keys: 'W throttle, S reverse, A and D steer. Press F to step off.',
    pad: '[RT] throttle, [LT] reverse, left stick steers. [Y] steps off.',
    touch: 'Stick up for throttle, down to reverse, sideways to steer.',
  },
  drive: {
    keys: 'Space is the handbrake. Press F to get out.',
    pad: '[RT] gas, [LT] brake, [A] handbrake, [Y] gets out.',
    touch: 'Stick up for gas, down to brake. Exit gets out.',
  },
  swim: {
    keys: 'Ctrl or C dives. Space comes back up.',
    pad: 'Hold [B] to dive. [A] comes back up.',
    touch: 'Hold Dive to go under. Climb comes back up.',
  },
  wanted: {
    keys: 'Police are searching the red area. Get out of it to lose them.',
    pad: 'Police are searching the red area. Get out of it to lose them.',
    touch: 'Police are searching the red area. Get out of it to lose them.',
  },
}

/** What each control does, then its keyboard and mouse, gamepad, and touch inputs. [X] is a key cap. */
const ROWS: [string, string, string, string][] = [
  ['Move, or steer', '[W][A][S][D]', 'Left stick', 'Thumbstick, left half'],
  ['Look', 'Mouse', 'Right stick', 'Drag on the right half'],
  ['Run, swim faster', '[Shift]', 'Hold [B] or click [L3]', 'Run (toggle)'],
  ['Jump, surface, climb out', '[Space]', '[A]', 'Jump, Climb'],
  ['Dive', '[Ctrl] or [C]', 'Hold [B] in water', 'Dive'],
  ['Get in or out of a car', '[F]', '[Y]', 'Get in, Exit'],
  ['Aim', 'Right mouse', '[LT]', 'Aim (toggle)'],
  ['Fire', 'Left mouse', '[RT]', 'Fire'],
  ['Reload', '[R]', '[X]', 'Reload'],
  ['Gas, brake, reverse', '[W][S]', '[RT][LT]', 'Thumbstick up and down'],
  ['Handbrake', '[Space]', '[A]', 'Brake'],
  ['Horn', '[H]', '[L3]', 'Horn'],
  ['Radio station, in a car or boat', '[Q][E]', '[LB][RB]', 'Not on touch'],
  ['Map and waypoint', '[M], click to set', '[Back]', 'Map, tap to set'],
  ['Pause and resume', '[Esc]', '[Start]', 'Pause button'],
  ['Menus', 'Arrows, [Enter], [Esc]', 'D-pad, [A], [B]', 'Tap'],
]

const COLUMN: Record<Device, 1 | 2 | 3> = { keys: 1, pad: 2, touch: 3 }
const TITLE: Record<Device, string> = {
  keys: 'Keyboard and mouse',
  pad: 'Gamepad',
  touch: 'Touch',
}

// Constant text only (above), never user input, so building HTML from it is safe.
const caps = (s: string) => s.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>')

/** Fills the Controls tab's list for `device`: the last one the player touched. */
export function showControls(device: Device): void {
  const list = document.getElementById('keys')
  const title = document.getElementById('keys-title')
  if (!list || !title) return
  title.textContent = TITLE[device]
  const col = COLUMN[device]
  list.innerHTML = ROWS.map((r) => `<dt>${caps(r[col])}</dt><dd>${r[0]}</dd>`).join('')
}
