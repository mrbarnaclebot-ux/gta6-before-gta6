/*
 * The car radio as pure state. Stations keep playing while you are away, like real radio:
 * coming back, a station picks up where its playlist would be now. No audio here.
 */

export const OFF = -1

export interface Spot {
  track: number
  /** Seconds into the track. */
  time: number
  /** Wall clock (seconds) when `track` and `time` were true. */
  at: number
}

export interface Radio {
  /** OFF, or the station index. */
  station: number
  spots: Spot[]
}

export function newRadio(stations: number, now: number): Radio {
  // Each station starts at a different point, so the first tune-in is mid-song.
  const spots = Array.from({ length: stations }, (_, i) => ({
    track: 0,
    time: 20 + i * 47,
    at: now,
  }))
  return { station: 0, spots }
}

/** Next (+1) or previous (-1) in the cycle Off, 1, 2, 3, Off. */
export function tune(r: Radio, step: 1 | -1): number {
  const n = r.spots.length + 1
  const slot = (r.station + 1 + step + n) % n
  r.station = slot - 1
  return r.station
}

/** Where a station's playlist is at `now`: the remembered spot advanced by the time since. */
export function spotAt(
  spot: Spot,
  now: number,
  durations: number[],
): { track: number; time: number } {
  const total = durations.reduce((a, b) => a + b, 0)
  let track = spot.track % durations.length
  let time = spot.time + Math.max(0, now - spot.at)
  if (total > 0) time %= total
  while (time >= durations[track]) {
    time -= durations[track]
    track = (track + 1) % durations.length
  }
  return { track, time }
}

/** Remember where a station is (on leaving it, or when its song changes). */
export function mark(r: Radio, station: number, track: number, time: number, now: number): void {
  if (station === OFF) return
  r.spots[station] = { track, time, at: now }
}
