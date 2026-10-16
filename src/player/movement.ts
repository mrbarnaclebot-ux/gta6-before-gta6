export const WALK_SPEED = 2.4
export const RUN_SPEED = 6.5
export const JUMP_SPEED = 6.2
// Heavier than 9.81 on purpose: real gravity makes third-person jumps feel floaty.
export const GRAVITY = -20
const ACCEL = 14
const TURN_RATE = 12
const COYOTE_TIME = 0.12
// Landing faster than this hurts: about a 5 m drop at this gravity.
const SAFE_LANDING = 14
const FALL_DAMAGE = 7

/** Health lost landing at vertical speed `vy` (negative is down): a two-story drop stings, a roof kills. */
export function fallDamage(vy: number): number {
  return Math.max(0, -vy - SAFE_LANDING) * FALL_DAMAGE
}

export type AnimState =
  'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'swim' | 'tread' | 'drive' | 'dead' | 'pull'

export interface Motion {
  vx: number
  vz: number
  vy: number
  airTime: number
}

/** Ease horizontal velocity toward the wished-for velocity so starts and stops are not instant. */
export function steer(m: Motion, wishX: number, wishZ: number, dt: number): void {
  const k = 1 - Math.exp(-ACCEL * dt)
  m.vx += (wishX - m.vx) * k
  m.vz += (wishZ - m.vz) * k
}

/** Gravity, jump, and the coyote window that lets you jump just after walking off a ledge. */
export function fall(m: Motion, grounded: boolean, jump: boolean, dt: number): boolean {
  m.airTime = grounded ? 0 : m.airTime + dt
  const canJump = m.airTime < COYOTE_TIME && m.vy <= 0
  if (jump && canJump) {
    m.vy = JUMP_SPEED
    m.airTime = COYOTE_TIME
    return true
  }
  m.vy = grounded && m.vy <= 0 ? -1 : m.vy + GRAVITY * dt
  return false
}

export function animState(m: Motion): AnimState {
  if (m.airTime >= COYOTE_TIME) return m.vy > 0 ? 'jump' : 'fall'
  const speed = Math.hypot(m.vx, m.vz)
  if (speed > (WALK_SPEED + RUN_SPEED) / 2) return 'run'
  return speed > 0.4 ? 'walk' : 'idle'
}

/** Rotate heading toward target along the shortest arc. */
export function turnToward(current: number, target: number, dt: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + diff * (1 - Math.exp(-TURN_RATE * dt))
}
