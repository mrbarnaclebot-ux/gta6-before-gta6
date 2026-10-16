/*
 * The speedboat's hydrodynamics as pure numbers: buoyancy per hull point, thrust, drag,
 * and planing. Boat space: +z forward (bow), +x left (port), y up, origin on the design
 * waterline, so a boat at rest in calm water sits with y = 0 on the surface.
 */

const G = 9.81
export const MASS = 1600
/** Where buoyancy is sampled: bow pair, mid pair, stern pair, on the hull bottom. */
export const HULL_POINTS: [number, number, number][] = [
  [0.75, -0.45, 2.1],
  [-0.75, -0.45, 2.1],
  [1.05, -0.45, -0.5],
  [-1.05, -0.45, -0.5],
  [1.0, -0.45, -2.8],
  [-1.0, -0.45, -2.8],
]
/** The hull floats with its sample points this deep, so the waterline lands at y = 0. */
const REST_DEPTH = 0.45
const SPRING = (MASS * G) / (HULL_POINTS.length * REST_DEPTH)
/** Past this depth a point is fully under: deeper water adds no more lift. */
const FULL_DEPTH = 1.25
// Most of critical damping per point: the hull settles in about one bob instead of porpoising.
const DAMP = 0.8 * 2 * Math.sqrt(SPRING * (MASS / HULL_POINTS.length))

/** Upward force in N on one hull point `depth` m under the surface moving up at `vy` m/s. */
export function buoyancy(depth: number, vy: number): number {
  if (depth <= 0) return 0
  return SPRING * Math.min(depth, FULL_DEPTH) - DAMP * vy
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** 0 in displacement mode, 1 fully on the plane: the hull rides on its own bow wave. */
export const planing = (speed: number) => smoothstep(5, 12, Math.abs(speed))

/** Top speed is about 20 m/s (39 knots), where thrust and drag meet. */
const THRUST = 6000
const REVERSE = 2200
const PROP_LIMIT = 26

/** Forward push of the outboard in N: `throttle` from -1 (reverse) to 1. */
export function thrust(throttle: number, speed: number, dead: boolean): number {
  if (dead || throttle === 0) return 0
  if (throttle < 0) return throttle * REVERSE * (speed < -4 ? 0.3 : 1)
  return throttle * THRUST * Math.max(0, 1 - (speed / PROP_LIMIT) ** 2)
}

/** Water drag along the hull in N, against the motion. Plowing is costly; planing is slick. */
export function hullDrag(speed: number): number {
  const plowing = 30 * (1 - planing(speed))
  return -(6.1 + plowing) * speed * Math.abs(speed)
}

/** Sideways resistance of the hull at one end, in N: the keel is what makes a boat carve. */
export function keelDrag(sideways: number): number {
  return -(1500 * sideways + 700 * sideways * Math.abs(sideways))
}

/** Hull lift from speed, as a share of the boat's weight: on the plane it rides higher. */
export const lift = (speed: number) => MASS * G * 0.3 * planing(speed)

/**
 * Bow-up trim in radians the hull settles to at `speed`: it rears up over its own bow wave
 * at the hump (about 7 m/s), then levels to a shallow running angle once on the plane.
 */
export function trim(speed: number): number {
  const v = Math.abs(speed)
  const hump = Math.exp(-(((v - 7) / 2.6) ** 2))
  return 0.09 * hump + 0.04 * planing(v)
}

/** How hard the water resists pitching, N m per radian: the spring of each point times its lever. */
export const PITCH_STIFFNESS = HULL_POINTS.reduce((s, p) => s + SPRING * p[2] * p[2], 0)
export const ROLL_STIFFNESS = HULL_POINTS.reduce((s, p) => s + SPRING * p[0] * p[0], 0)

/** Roll toward the inside of a turn in radians, at full rudder: more at speed, as real hulls bank. */
export const bank = (steer: number, speed: number) => -steer * 0.14 * planing(speed)

/** How far the outboard swings, radians, at full rudder. */
export const RUDDER = 0.45
/** Side force of the lower unit acting as a rudder, N per (m/s)^2, at full lock. */
export const FIN = 60
