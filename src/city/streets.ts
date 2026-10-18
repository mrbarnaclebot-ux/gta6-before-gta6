/*
 * What each kind of city street is like across: half its paved width, the sidewalk beside
 * it, and its lanes. Avenues are four lanes with a planted median that gives way to a
 * left-turn lane near each junction; streets are one lane each way with a parking lane;
 * alleys are narrow service lanes behind blocks. The canal and the paved city's outer edge
 * are lines in the network too, so faces stop at them.
 */

export type StreetKind = 'avenue' | 'street' | 'alley' | 'canal' | 'edge'

export const CANAL_HALF = 14

export interface Section {
  /** Half the width from curb to curb (the canal: from bank to bank). */
  half: number
  /** Sidewalk from the curb to the lot line. */
  walk: number
  /** Curb corner radius where two streets of this kind meet. */
  radius: number
  /** Cruising speed, m/s; 0 where traffic does not drive. */
  speed: number
}

export const SECTION: Record<StreetKind, Section> = {
  avenue: { half: 9, walk: 4.5, radius: 6, speed: 13 },
  street: { half: 6, walk: 4, radius: 5, speed: 10 },
  alley: { half: 3, walk: 1, radius: 1.5, speed: 0 },
  canal: { half: CANAL_HALF, walk: 4, radius: 0, speed: 0 },
  edge: { half: 0, walk: 0, radius: 0, speed: 0 },
}

/** Avenue cross-section, meters right of the centerline for traffic going one way. */
export const AVENUE = {
  /** Half the median, and the turn lane that takes its place near a junction. */
  median: 2,
  /** Lane centers: inner and outer through lanes. */
  lanes: [3.65, 6.95],
  /** Center of the left-turn lane where the median gives way. */
  turn: 0.35,
  /** The median ends this far before the stop bar; the turn lane runs alongside. */
  bay: 26,
}

/** Street cross-section: the travel lane's center and the parking lane's. */
export const STREET = { lane: 1.65, parking: 4.6 }

export const drives = (k: StreetKind) => SECTION[k].speed > 0
