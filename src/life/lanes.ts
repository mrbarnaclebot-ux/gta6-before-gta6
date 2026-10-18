/*
 * What a traffic car follows: waypoints with speed limits, handed out a leg at a time.
 * The city's lanes (city-lanes.ts) and the highway's (land/lane-graph.ts) are both directed
 * graphs of lane edges; highway-traffic.ts drives either.
 */

export const CRUISE = 11
export const TURN_SPEED = 5

/** Where a lane meets a junction's stop bar: lights (by phase) or an all-way stop sign. */
export interface Stop {
  junction: number
  phase: 0 | 1
  signal: boolean
}

/** A point to drive through and the speed limit on the way to it. `y` is 0 (street level) if left out. */
export interface Waypoint {
  x: number
  y?: number
  z: number
  limit: number
  /** The car holds short of this point until the lights or the stop sign let it go. */
  stop?: Stop
  /** Set once a car has come to a halt at this stop sign and may go on. */
  cleared?: boolean
}

/** Hands a traffic car its route one leg at a time. */
export interface Driver {
  next(): Waypoint[]
}

/** A car's start: where it is placed, facing `yaw`, and who picks its turns from there. */
export interface Start {
  x: number
  y: number
  z: number
  yaw: number
  driver: Driver
}
