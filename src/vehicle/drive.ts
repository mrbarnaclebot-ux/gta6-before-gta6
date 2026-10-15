/*
 * Pure driving rules: what the pedals and wheel do at a given speed. Speeds are
 * forward m/s along the car (negative when reversing). No three.js or Rapier here.
 */

export const ENGINE_FORCE = 2600
export const REVERSE_FORCE = 1400
export const REVERSE_TOP = 9
export const BRAKE = 34
export const HANDBRAKE = 70
/** Light drag from the drivetrain so a released throttle coasts down instead of rolling forever. */
export const ENGINE_BRAKE = 1.2
const MAX_STEER = 0.6
const STEER_FALLOFF = 16
const STEER_RATE = 2.6
const BASE_FOV = 55
const FOV_GAIN = 18
const FOV_TOP = 45
// Water this far above the car's floor floods the engine.
const STALL_DEPTH = 0.55

export interface Pedals {
  /** Engine force per driven wheel, newtons; negative reverses. */
  engine: number
  /** Brake impulse per wheel. */
  brake: number
}

/**
 * W drives forward, but brakes first while still rolling backward; S brakes while
 * rolling forward, then reverses up to a capped speed. A stalled engine only brakes.
 */
export function pedals(throttle: number, speed: number, stalled = false): Pedals {
  if (throttle > 0 && speed < -1) return { engine: 0, brake: BRAKE }
  if (throttle < 0 && speed > 1) return { engine: 0, brake: BRAKE }
  if (throttle === 0 || stalled) return { engine: 0, brake: ENGINE_BRAKE }
  if (throttle > 0) return { engine: ENGINE_FORCE * throttle, brake: 0 }
  if (speed <= -REVERSE_TOP) return { engine: 0, brake: 0 }
  return { engine: REVERSE_FORCE * throttle, brake: 0 }
}

/** Full lock at walking pace, narrowing with speed so a highway lane change is not a spin-out. */
export function maxSteer(speed: number): number {
  return MAX_STEER / (1 + Math.abs(speed) / STEER_FALLOFF)
}

/** Turn the wheels toward the wished angle at a hand-like rate instead of snapping. */
export function steerToward(current: number, axis: number, speed: number, dt: number): number {
  const target = axis * maxSteer(speed)
  const step = STEER_RATE * dt
  return current + Math.max(-step, Math.min(step, target - current))
}

/** Field of view widens with speed to sell it, capped at highway pace. */
export function chaseFov(speed: number): number {
  return BASE_FOV + FOV_GAIN * Math.min(1, Math.abs(speed) / FOV_TOP)
}

/** Air drag, newtons, opposing the velocity; sets top speed near 55 m/s (200 km/h). */
export function drag(speed: number): number {
  return -1.7 * speed * Math.abs(speed)
}

/** Once flooded, an engine stays dead; water depth is measured above the car's floor. */
export function floods(stalled: boolean, depthAboveFloor: number): boolean {
  return stalled || depthAboveFloor > STALL_DEPTH
}
