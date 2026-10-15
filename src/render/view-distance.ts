import type { Distance } from './graphics'

/** What one render distance setting reaches, in meters, and how thick the haze is. */
export interface Reach {
  /** Camera far plane: whole building chunks past it are culled. */
  far: number
  /** FogExp2 density at sea level: everything fades into the sky well before `far`. */
  fog: number
  /** Multiplier on the palm detail and fern draw distances (80 m and 140 m at 1). */
  plants: number
  /** Parked cars farther than this from the player are hidden. */
  cars: number
  /** Shadows reach this far from the camera. */
  shadows: number
}

export const REACH: Record<Distance, Reach> = {
  near: { far: 700, fog: 0.0026, plants: 0.6, cars: 90, shadows: 60 },
  medium: { far: 1200, fog: 0.002, plants: 0.8, cars: 120, shadows: 100 },
  far: { far: 2200, fog: 0.0016, plants: 1, cars: 150, shadows: 150 },
  ultra: { far: 3500, fog: 0.0012, plants: 1.5, cars: 220, shadows: 240 },
}
