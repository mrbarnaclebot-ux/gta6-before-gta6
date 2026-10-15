/*
 * Pure pistol rules: magazine, reserve, fire rate, and reload timing. No three.js here.
 */

export const MAG_SIZE = 12
export const START_RESERVE = 96
/** Seconds between shots: a semi-auto pistol fired as fast as you can click. */
export const FIRE_INTERVAL = 0.22
/** Matches the length of the mannequin's Pistol_Reload clip. */
export const RELOAD_TIME = 1.6

export interface Pistol {
  mag: number
  reserve: number
  /** Seconds until the next shot is allowed. */
  cooldown: number
  /** Seconds left on a reload in progress; 0 when not reloading. */
  reloading: number
}

export function newPistol(): Pistol {
  return { mag: MAG_SIZE, reserve: START_RESERVE, cooldown: 0, reloading: 0 }
}

/** Advance the timers. A finished reload moves rounds from the reserve into the magazine. */
export function tick(p: Pistol, dt: number): void {
  p.cooldown = Math.max(0, p.cooldown - dt)
  if (p.reloading <= 0) return
  p.reloading = Math.max(0, p.reloading - dt)
  if (p.reloading > 0) return
  const take = Math.min(MAG_SIZE - p.mag, p.reserve)
  p.mag += take
  p.reserve -= take
}

/** Starts a reload unless one is running, the magazine is full, or the reserve is empty. */
export function reload(p: Pistol): boolean {
  if (p.reloading > 0 || p.mag === MAG_SIZE || p.reserve === 0) return false
  p.reloading = RELOAD_TIME
  return true
}

/** Fires one round if ready. Emptying the magazine starts a reload on its own. */
export function fire(p: Pistol): boolean {
  if (p.cooldown > 0 || p.reloading > 0 || p.mag === 0) return false
  p.mag--
  p.cooldown = FIRE_INTERVAL
  if (p.mag === 0) reload(p)
  return true
}
