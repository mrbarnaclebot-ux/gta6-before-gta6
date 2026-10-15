/*
 * Swimming rules as pure functions of "feet depth": how far the feet sit below
 * the water surface. Player feeds them from physics; tests feed them numbers.
 */

export type Mode = 'walking' | 'swimming'

/** Feet depth while floating: head and shoulders above the surface. */
export const FLOAT_DEPTH = 1.35
/** Head height above the feet; deeper than this the head is under. */
export const HEAD_HEIGHT = 1.65
// Enter deeper than you leave, so standing at the threshold does not flicker between modes.
export const ENTER_DEPTH = 1.25
export const EXIT_DEPTH = 1.0
export const SWIM_SPEED = 1.6
export const SWIM_SPRINT = 3.0
export const MAX_BREATH = 25
export const MAX_HEALTH = 100
const DIVE_SPEED = 1.8
const RISE_SPEED = 1.0
const SURFACE_SPEED = 2.4
const SPRING = 3
const WATER_DRAG = 4
const REFILL_RATE = 5
const DROWN_DPS = 10

export function nextMode(mode: Mode, feetDepth: number): Mode {
  if (mode === 'walking') return feetDepth > ENTER_DEPTH ? 'swimming' : 'walking'
  return feetDepth < EXIT_DEPTH ? 'walking' : 'swimming'
}

/**
 * Vertical speed in water: dive pulls down, otherwise buoyancy springs the body
 * back to the floating depth, faster with surface held. Drag eases toward the
 * target, so falling in from a bridge slows down instead of stopping dead.
 */
export function buoyancy(
  vy: number,
  feetDepth: number,
  dive: boolean,
  surface: boolean,
  dt: number,
): number {
  const up = surface ? SURFACE_SPEED : RISE_SPEED
  const target = dive
    ? -DIVE_SPEED
    : Math.min(Math.max((feetDepth - FLOAT_DEPTH) * SPRING, -up), up)
  return vy + (target - vy) * (1 - Math.exp(-WATER_DRAG * dt))
}

/** Wading slows walking as the water gets deeper, down to about half speed at chest height. */
export function wadeFactor(feetDepth: number): number {
  const t = Math.min(Math.max((feetDepth - 0.3) / 0.9, 0), 1)
  return 1 - 0.45 * t
}

export interface Vitals {
  health: number
  breath: number
}

/** Breath drains while the head is under and refills above; at zero breath you take damage. */
export function breathe(v: Vitals, headUnder: boolean, dt: number): void {
  const drain = headUnder ? -dt : dt * REFILL_RATE
  const breath = v.breath + drain
  if (breath < 0) v.health = Math.max(0, v.health + breath * DROWN_DPS)
  v.breath = Math.min(Math.max(breath, 0), MAX_BREATH)
}
