/*
 * Wanted level as pure data. Crimes add heat; stars are whole units of heat.
 * There are no police yet, so "out of sight" means outside the search area
 * around the last crime. Out there, stars drop one at a time after a delay.
 */

export const MAX_STARS = 5
/** Seconds outside the search area before the first star drops. */
export const COOL_DELAY = 6
/** Seconds per star after that. */
export const COOL_RATE = 8

export type Crime = 'gunshot' | 'vandalism' | 'assault' | 'murder' | 'runover'

const HEAT: Record<Crime, number> = {
  gunshot: 0.35,
  vandalism: 0.25,
  assault: 0.6,
  murder: 1,
  runover: 1,
}

export interface Wanted {
  heat: number
  /** Center of the search area: where the last crime happened. */
  x: number
  z: number
  /** Seconds spent outside the search area since the last crime. */
  unseen: number
}

export const newWanted = (): Wanted => ({ heat: 0, x: 0, z: 0, unseen: 0 })

export function stars(w: Wanted): number {
  return Math.min(MAX_STARS, Math.floor(w.heat + 1e-9))
}

/** Any crime earns at least one star and recenters the search on it. */
export function report(w: Wanted, crime: Crime, x: number, z: number): void {
  w.heat = Math.min(MAX_STARS, Math.max(1, w.heat + HEAT[crime]))
  w.x = x
  w.z = z
  w.unseen = 0
}

/** One star is a couple of blocks; five stars cover most of the map. */
export function searchRadius(w: Wanted): number {
  return 60 + 40 * stars(w)
}

/** True while the stars should blink: the player is out of sight and they are cooling. */
export const cooling = (w: Wanted) => stars(w) > 0 && w.unseen > 0

/** Advance by dt with the player at (x, z). Inside the search area the heat holds. */
export function cool(w: Wanted, x: number, z: number, dt: number): void {
  if (stars(w) === 0) return void (w.heat = 0)
  const inside = Math.hypot(x - w.x, z - w.z) < searchRadius(w)
  w.unseen = inside ? 0 : w.unseen + dt
  if (w.unseen < COOL_DELAY + COOL_RATE) return
  w.heat = stars(w) - 1
  w.unseen = COOL_DELAY
}

export function clear(w: Wanted): void {
  Object.assign(w, newWanted())
}
