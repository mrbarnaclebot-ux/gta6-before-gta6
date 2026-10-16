/*
 * Pure vehicle sound math: a pretend gearbox turns speed into engine rpm, and rpm picks and
 * pitches the four recorded engine loops. No Web Audio here.
 */

export const IDLE_RPM = 900
export const REDLINE = 6300
/** Top speed of each gear in m/s; a shift drops the revs back to SHIFT_RPM. */
const GEAR_TOP = [8, 15, 23, 32, 43, 60]
const SHIFT_RPM = 2900
const TOP_RPM = 6000
/** The rpm each loop was recorded at: idle, 2k, 4k, 5k. */
export const LAYER_RPM = [IDLE_RPM, 2000, 4000, 5000]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Engine speed for a road speed (m/s, either direction) and throttle (-1 to 1). */
export function rpmFor(speed: number, throttle: number): number {
  const v = Math.abs(speed)
  const gear = GEAR_TOP.findIndex((top) => v <= top)
  const g = gear < 0 ? GEAR_TOP.length - 1 : gear
  const lo = g === 0 ? 0 : GEAR_TOP[g - 1]
  const t = clamp((v - lo) / (GEAR_TOP[g] - lo), 0, 1)
  const base = g === 0 ? IDLE_RPM : SHIFT_RPM
  let rpm = base + t * (TOP_RPM - base)
  // Off the throttle the engine is dragged along, a little lower and quieter.
  if (Math.abs(throttle) < 0.1) rpm -= 250
  // Revving at a standstill (or crawling): the throttle alone lifts the needle.
  rpm = Math.max(rpm, IDLE_RPM + Math.abs(throttle) * 1600 * (1 - clamp(v / 4, 0, 1)))
  return clamp(rpm, IDLE_RPM, REDLINE)
}

export interface Mix {
  gains: number[]
  rates: number[]
}

/**
 * Equal-power crossfade between the two recorded loops either side of `rpm`, each pitched so
 * it sounds at `rpm`. `load` (0 to 1, how hard the throttle works) adds weight.
 */
export function engineMix(rpm: number, load: number): Mix {
  const n = LAYER_RPM.length
  let i = 0
  while (i < n - 2 && rpm > LAYER_RPM[i + 1]) i++
  const t = clamp((rpm - LAYER_RPM[i]) / (LAYER_RPM[i + 1] - LAYER_RPM[i]), 0, 1)
  const level = 0.55 + 0.45 * clamp(load, 0, 1)
  const gains = LAYER_RPM.map(() => 0)
  gains[i] = Math.cos((t * Math.PI) / 2) * level
  gains[i + 1] = Math.sin((t * Math.PI) / 2) * level
  const rates = LAYER_RPM.map((r) => clamp(rpm / r, 0.5, 2))
  return { gains, rates }
}

/** The outboard: one loop pitched and swelled by speed and throttle; the wake by speed alone. */
export function boatMix(
  speed: number,
  throttle: number,
): { motor: number; rate: number; wake: number } {
  const s = clamp(Math.abs(speed) / 20, 0, 1)
  const push = Math.abs(throttle)
  return {
    motor: 0.3 + 0.7 * Math.max(push * 0.8, s),
    rate: 0.6 + 0.5 * s + 0.15 * push,
    wake: clamp(Math.abs(speed) / 14, 0, 1),
  }
}

/** A traffic car's single engine loop: pitch by its speed. */
export const trafficRate = (speed: number) => 0.75 + 0.6 * clamp(Math.abs(speed) / 18, 0, 1)

/**
 * How hard a vehicle just hit something, 0 to 1, from the change in its velocity over one
 * frame. Braking and bumps (under about 3 g) are not crashes.
 */
export function impact(dv: number, dt: number): number {
  if (dt <= 0 || dv / dt < 30 || dv < 1.5) return 0
  return clamp((dv - 1.5) / 10, 0.1, 1)
}

/** Pitch shift for a source moving toward the listener at `closing` m/s (negative: away). */
export const doppler = (closing: number) => clamp(343 / (343 - closing), 0.85, 1.15)
