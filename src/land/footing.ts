/*
 * The one way anything is set on the ground: trees, bushes, rocks, lamps, props, parked
 * and traffic cars, people. Pure math over a surface height function (the analytic
 * terrain, roads, and sidewalks), or over heights a raycast found (bridge decks).
 */

/** Ground height at (x, z). */
export type Surface = (x: number, z: number) => number

/** Unit up vector of a tilted thing. */
export type Up = [number, number, number]

const RING = 8

/**
 * Height for something upright (a trunk, a pole, a stilt frame) with a round footprint:
 * the lowest ground under it, so it sinks into the uphill side and never floats on the
 * downhill one. `sink` pushes it a little deeper still.
 */
export function stand(surface: Surface, x: number, z: number, radius: number, sink = 0): number {
  let low = surface(x, z)
  for (let k = 0; k < RING && radius > 0; k++) {
    const a = (k / RING) * Math.PI * 2
    low = Math.min(low, surface(x + radius * Math.cos(a), z + radius * Math.sin(a)))
  }
  return low - sink
}

/** How a rigid footprint sits: its height at the center, and its nose-up pitch and right-down roll. */
export interface Rest {
  y: number
  pitch: number
  roll: number
}

/**
 * A rigid box (a car, a bench) resting on four corner heights: front-left, front-right,
 * back-left, back-right, `halfL` ahead and behind and `halfW` to each side. The plane through
 * them is lowered until no corner floats above its ground.
 */
export function restOnCorners(h: number[], halfL: number, halfW: number): Rest {
  const [fl, fr, bl, br] = h
  const pitch = Math.atan2((fl + fr - bl - br) / 2, 2 * halfL)
  const roll = Math.atan2((fl + bl - fr - br) / 2, 2 * halfW)
  const mid = (fl + fr + bl + br) / 4
  const sx = (fr + br - fl - bl) / 4
  const sz = (fl + fr - bl - br) / 4
  const plane = [mid - sx + sz, mid + sx + sz, mid - sx - sz, mid + sx - sz]
  const lift = Math.max(...plane.map((p, i) => p - h[i]))
  return { y: mid - lift, pitch, roll }
}

/** The four corners of a footprint facing `yaw` (0 faces +z), in the order restOnCorners takes. */
export function corners(x: number, z: number, yaw: number, halfL: number, halfW: number) {
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  // Right of the heading, with yaw 0 facing +z, is -x.
  const rx = -fz
  const rz = fx
  return [
    [1, -1],
    [1, 1],
    [-1, -1],
    [-1, 1],
  ].map(([f, s]) => ({
    x: x + f * halfL * fx + s * halfW * rx,
    z: z + f * halfL * fz + s * halfW * rz,
  }))
}

/** A rigid footprint on the surface: corners sampled, plane fitted, nothing floating. */
export function rest(
  surface: Surface,
  x: number,
  z: number,
  yaw: number,
  halfL: number,
  halfW: number,
): Rest {
  const h = corners(x, z, yaw, halfL, halfW).map((c) => surface(c.x, c.z))
  return restOnCorners(h, halfL, halfW)
}

/** The surface's up vector averaged over a footprint of `radius`, for rocks and props that lie with the ground. */
export function upAt(surface: Surface, x: number, z: number, radius: number): Up {
  const r = Math.max(radius, 0.5)
  const dx = (surface(x + r, z) - surface(x - r, z)) / (2 * r)
  const dz = (surface(x, z + r) - surface(x, z - r)) / (2 * r)
  const l = Math.hypot(dx, 1, dz)
  return [-dx / l, 1 / l, -dz / l]
}

/**
 * Height for something that tilts with the ground (a rock) on a round footprint: the base
 * plane through the center, lowered until no point of the rim floats above the ground.
 */
export function lie(surface: Surface, x: number, z: number, radius: number, up: Up): number {
  const y = surface(x, z)
  let lift = 0
  for (let k = 0; k < RING; k++) {
    const a = (k / RING) * Math.PI * 2
    const px = x + radius * Math.cos(a)
    const pz = z + radius * Math.sin(a)
    const plane = y - (up[0] * (px - x) + up[2] * (pz - z)) / up[1]
    lift = Math.max(lift, plane - surface(px, pz))
  }
  return y - lift
}
