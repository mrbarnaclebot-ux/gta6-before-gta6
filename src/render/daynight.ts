/*
 * Time of day as pure numbers. The sun rises over the ocean (+x) at 6:00, sets
 * over the city (-x) at 18:00, and peaks 65 degrees up toward +z. At 10:00 it
 * sits where the sun is painted in the daytime HDRI the look was tuned with.
 */

/** Real seconds per game hour: a full day takes 20 minutes. */
export const HOUR_SECONDS = 50
export const START_HOUR = 10
const TILT = (65 * Math.PI) / 180

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)

export function advance(hours: number, dt: number): number {
  return (hours + dt / HOUR_SECONDS) % 24
}

/** Unit vector toward the sun. */
export function sunDirection(hours: number): [number, number, number] {
  const a = ((hours - 6) / 12) * Math.PI
  return [Math.cos(a), Math.sin(a) * Math.sin(TILT), Math.sin(a) * Math.cos(TILT)]
}

export interface Lighting {
  /** Direction of the shadow-casting light: the sun by day, the moon by night. */
  light: [number, number, number]
  /** Its color with intensity folded in, linear RGB. */
  color: number[]
  /** 1 at full daylight, 0 at night: scales the sky and image-based light. */
  day: number
  /** 0 by day, 1 once it is dark enough for street lights and neon. */
  night: number
  /** Strength of the orange glow around the sun near the horizon. */
  dusk: number
}

const NOON = [1.0, 0.9, 0.78]
const LOW_SUN = [1.0, 0.5, 0.24]
const MOON = [0.55, 0.66, 1.0]
export const SUN_POWER = 4
const MOON_POWER = 0.6

export function lighting(hours: number): Lighting {
  const sun = sunDirection(hours)
  const y = sun[1]
  const sunPower = SUN_POWER * smooth(-0.02, 0.12, y)
  const moon = sun.map((v) => -v) as [number, number, number]
  const moonPower = MOON_POWER * smooth(0.0, 0.2, moon[1])
  const byDay = sunPower >= moonPower
  const tint = byDay ? mix(LOW_SUN, NOON, smooth(0.02, 0.4, y)) : MOON
  return {
    light: byDay ? sun : moon,
    color: tint.map((c) => c * (byDay ? sunPower : moonPower)),
    day: smooth(-0.12, 0.3, y),
    night: 1 - smooth(-0.1, 0.06, y),
    dusk: smooth(-0.16, 0.0, y) * (1 - smooth(0.05, 0.35, y)),
  }
}
