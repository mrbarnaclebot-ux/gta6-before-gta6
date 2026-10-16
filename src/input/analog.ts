/** Pure stick math shared by the gamepad and the touch thumbstick. */

export type Vec = { x: number; y: number }

// Sticks rest a few percent off center; below this the input is noise.
export const DEADZONE = 0.18
// Above 1 the stick is gentle near the middle and quick at the rim: fine aim, fast turns.
export const CURVE = 1.6

/**
 * Radial deadzone plus a power curve: the direction is kept, the length is rescaled
 * so it starts at 0 just past the deadzone and reaches 1 at the rim.
 */
export function shape(v: Vec, deadzone = DEADZONE, curve = CURVE): Vec {
  const m = Math.hypot(v.x, v.y)
  if (m <= deadzone) return { x: 0, y: 0 }
  const t = Math.min(1, (m - deadzone) / (1 - deadzone)) ** curve
  return { x: (v.x / m) * t, y: (v.y / m) * t }
}

/** A trigger's analog value with its own small deadzone, 0 to 1. */
export function trigger(value: number, deadzone = 0.06): number {
  return value <= deadzone ? 0 : Math.min(1, (value - deadzone) / (1 - deadzone))
}

/**
 * The floating thumbstick: the finger's offset from where it landed, as a vector of length
 * at most 1 (`radius` pixels is full deflection), and where the knob draws in pixels.
 */
export function thumbstick(origin: Vec, finger: Vec, radius: number) {
  const dx = finger.x - origin.x
  const dy = finger.y - origin.y
  const d = Math.hypot(dx, dy)
  const k = d > radius ? radius / d : 1
  const knob = { x: dx * k, y: dy * k }
  return { knob, value: { x: knob.x / radius, y: knob.y / radius } }
}

/** Sum of inputs clamped to length 1, so a key plus a stick is never faster than either. */
export function clampLength(x: number, y: number): Vec {
  const m = Math.hypot(x, y)
  return m > 1 ? { x: x / m, y: y / m } : { x, y }
}

export const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))
