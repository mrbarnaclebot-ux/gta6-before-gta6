import { ROAD_HALF, type CityLayout } from '../city/layout'
import type { Rand } from '../city/rng'

/*
 * Traffic routes on the road grid as pure data. A car drives in the right-hand
 * lane of a road; at each intersection it goes straight on or turns onto the
 * crossing road, along a curve that joins the two lanes.
 */

/** Center of the inner lane: between the center line and the dashed lane line. */
export const LANE_OFFSET = 1.9
export const CRUISE = 11
export const TURN_SPEED = 5
const CURVE_STEPS = 6

type Axis = 'x' | 'z'
type Grid = Pick<CityLayout, 'xRoads' | 'zRoads'>

/** On the road running along `axis` that sits at `at` on the other axis, `u` meters along, heading `dir`. */
export interface Heading {
  axis: Axis
  at: number
  dir: 1 | -1
  u: number
}

/** A point to drive through and the speed limit on the way to it. `y` is 0 (street level) if left out. */
export interface Waypoint {
  x: number
  y?: number
  z: number
  limit: number
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

/** Starts a car on the road grid at `h`, turning at random at each intersection. */
export function gridStart(g: Grid, h: Heading, r: Rand): Start {
  let route = h
  const driver = {
    next: () => {
      const leg = nextLeg(g, route, r)
      route = leg.next
      return leg.points
    },
  }
  return { ...lanePoint(h, h.u), y: 0, yaw: yawOf(h), driver }
}

const other = (a: Axis): Axis => (a === 'x' ? 'z' : 'x')
/** Where crossing roads meet a road that runs along `axis`. */
const crossings = (g: Grid, axis: Axis) => (axis === 'z' ? g.zRoads : g.xRoads)
const beyond = (list: number[], from: number, dir: number) =>
  list.filter((v) => (v - from) * dir > 1e-6).sort((a, b) => (a - b) * dir)

/** World point in the right-hand lane. */
export function lanePoint(h: Omit<Heading, 'u'>, u: number): { x: number; z: number } {
  return h.axis === 'z'
    ? { x: h.at - h.dir * LANE_OFFSET, z: u }
    : { x: u, z: h.at + h.dir * LANE_OFFSET }
}

/** Yaw (0 faces +z) of a car driving this way. */
export function yawOf(h: Omit<Heading, 'u' | 'at'>): number {
  return h.axis === 'z' ? (h.dir > 0 ? 0 : Math.PI) : (h.dir * Math.PI) / 2
}

/** The ways out of the next intersection that lead to yet another one: no U-turns, no dead ends. */
function exits(g: Grid, h: Heading, at: number): Heading[] {
  const out: Heading[] = []
  if (beyond(crossings(g, h.axis), at, h.dir).length) {
    out.push({ ...h, u: at + h.dir * ROAD_HALF })
  }
  for (const dir of [1, -1] as const) {
    if (beyond(crossings(g, other(h.axis)), h.at, dir).length) {
      out.push({ axis: other(h.axis), at, dir, u: h.at + dir * ROAD_HALF })
    }
  }
  return out
}

/** Straight on is twice as likely as either turn. */
function choose(options: Heading[], axis: Axis, r: Rand): Heading {
  const weights = options.map((o) => (o.axis === axis ? 2 : 1))
  let roll = r() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < options.length; i++) if ((roll -= weights[i]) < 0) return options[i]
  return options[options.length - 1]
}

/** A quadratic curve from the end of one lane to the start of the next, through where the lanes cross. */
function turn(from: Heading, to: Heading, entryU: number): Waypoint[] {
  const a = lanePoint(from, entryU)
  const c = lanePoint(
    from,
    to.axis === 'z' ? to.at - to.dir * LANE_OFFSET : to.at + to.dir * LANE_OFFSET,
  )
  const b = lanePoint(to, to.u)
  const out: Waypoint[] = [{ ...a, limit: TURN_SPEED }]
  for (let i = 1; i <= CURVE_STEPS; i++) {
    const t = i / CURVE_STEPS
    const [p, q, s] = [(1 - t) ** 2, 2 * t * (1 - t), t * t]
    out.push({ x: p * a.x + q * c.x + s * b.x, z: p * a.z + q * c.z + s * b.z, limit: TURN_SPEED })
  }
  return out
}

/**
 * Drive to the next intersection and through it. Returns the waypoints and the
 * heading on the far side. The caller must be on a road with an intersection ahead.
 */
export function nextLeg(g: Grid, h: Heading, r: Rand): { points: Waypoint[]; next: Heading } {
  const at = beyond(crossings(g, h.axis), h.u, h.dir)[0]
  const next = choose(exits(g, h, at), h.axis, r)
  if (next.axis === h.axis) {
    return { points: [{ ...lanePoint(next, next.u), limit: CRUISE }], next }
  }
  return { points: turn(h, next, at - h.dir * ROAD_HALF), next }
}

/** A random spot mid-block on a random road, facing a way that has an intersection ahead. */
export function randomHeading(g: Grid, r: Rand): Heading {
  const axis: Axis = r() < 0.5 ? 'x' : 'z'
  const roads = crossings(g, other(axis))
  const along = crossings(g, axis)
  const i = Math.floor(r() * (along.length - 1))
  const dir = r() < 0.5 ? 1 : -1
  const u = along[i] + ROAD_HALF + 2 + r() * (along[i + 1] - along[i] - 2 * ROAD_HALF - 4)
  return { axis, at: roads[Math.floor(r() * roads.length)], dir, u }
}
