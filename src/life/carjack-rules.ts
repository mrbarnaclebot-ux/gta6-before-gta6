import type { Crime } from './wanted'

/** A driver can be pulled out only from a car crawling slower than this, m/s. */
export const JACK_SPEED = 3
/** The player must be this close to the car's center, meters. */
export const JACK_RANGE = 3.6
/** A slow driver waits for someone who walks up this close, so they can reach the door. */
export const HOLD_RANGE = 4.5
/** People and police cars within this many meters see it happen. */
export const WITNESS_RANGE = 30

/**
 * Stolen cars kept per kind, so the wheel pool (30 cars a kind in wheel-batch.ts, 24 sports
 * cars at startup) and the physics world stop growing.
 * ponytail: the oldest is scrapped even if it is in view; scrap only off-screen ones if the pop shows.
 */
export const MAX_STOLEN = 4

/** The stolen car to scrap before keeping another of `kind`: the oldest of that kind, at the cap. */
export function scrapFor<T extends { visual: { kind: string } }>(
  stolen: T[],
  kind: string,
  max = MAX_STOLEN,
): T | null {
  const same = stolen.filter((c) => c.visual.kind === kind)
  return same.length >= max ? same[0] : null
}

/** True when the player at `distance` m can pull the driver out of a car going `speed` m/s. */
export function canJack(speed: number, distance: number, wrecked: boolean): boolean {
  return !wrecked && Math.abs(speed) < JACK_SPEED && distance < JACK_RANGE
}

/** A driver at `speed` m/s stops for a player `distance` m away who is walking up to them. */
export function driverWaits(speed: number, distance: number): boolean {
  return Math.abs(speed) < JACK_SPEED && distance < HOLD_RANGE
}

/** What the theft is charged as: a police cruiser always (its crew saw), else only if seen. */
export function jackCrime(police: boolean, witnesses: number): Crime | null {
  if (police) return 'copcar'
  return witnesses > 0 ? 'carjack' : null
}
