import { shape, trigger } from './analog'
import type { Action } from './bindings'
import type { Axes, Context } from './input'

/** Button indices of the W3C "standard" gamepad mapping (Xbox names; PlayStation is the same layout). */
export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  L3: 10,
  R3: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const

// A trigger counts as a button press past this, for fire and aim.
const TRIGGER_DOWN = 0.5

/** Buttons that mean the same thing in every context. RT fires and LT aims only on foot (the car reads them as pedals). */
const ALWAYS: [number, Action][] = [
  [PAD.A, 'jump'],
  [PAD.X, 'reload'],
  [PAD.Y, 'use'],
  [PAD.LB, 'radioPrev'],
  [PAD.RB, 'radioNext'],
  [PAD.BACK, 'map'],
  [PAD.START, 'pause'],
  [PAD.RT, 'fire'],
  [PAD.LT, 'aim'],
]

/**
 * The actions a pad's buttons hold right now. B is hold-to-run on foot and hold-to-dive in
 * water (it reads as "the other face button": sprint where there is ground, down where there
 * is not). L3 is the horn in a car and also runs on foot.
 */
export function padActions(value: (button: number) => number, context: Context): Set<Action> {
  const out = new Set<Action>()
  for (const [b, a] of ALWAYS) if (value(b) > TRIGGER_DOWN) out.add(a)
  if (value(PAD.B) > TRIGGER_DOWN) out.add(context === 'swimming' ? 'dive' : 'run')
  if (value(PAD.L3) > TRIGGER_DOWN) out.add(context === 'driving' ? 'horn' : 'run')
  return out
}

/** Left stick to move or steer, triggers to pedals, right stick to look (pixels per second at full tilt). */
export function padAxes(axes: readonly number[], value: (button: number) => number) {
  const move = shape({ x: axes[0] ?? 0, y: axes[1] ?? 0 })
  const look = shape({ x: axes[2] ?? 0, y: axes[3] ?? 0 })
  const drive: Axes = {
    x: move.x,
    z: -move.y,
    throttle: trigger(value(PAD.RT)) - trigger(value(PAD.LT)),
  }
  return { drive, look }
}
