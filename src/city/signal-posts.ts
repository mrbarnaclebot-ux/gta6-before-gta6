import type { P2 } from '../land/polyline'
import { CROSSWALK, leaves, type End } from './junctions'
import type { CityLayout } from './layout'
import { AVENUE, SECTION, STREET } from './streets'

/*
 * Where the traffic lights and stop signs stand. Each approach to a junction with lights
 * gets a mast arm on the far side of the junction, on the driver's right, reaching out over
 * its lanes with a signal head above each one, facing the oncoming cars. Each approach to an
 * all-way stop gets a stop sign at its right curb just before the stop bar. Pure data.
 */

/** A mast-arm signal: the pole's foot, the way the heads face, the arm's reach, and the heads along it. */
export interface SignalPost {
  x: number
  z: number
  /** Yaw the heads face (toward the oncoming traffic). */
  yaw: number
  /** Meters from the pole to the arm's tip, out over the road (to the pole's right as the heads face). */
  arm: number
  /** Heads at these distances along the arm. */
  heads: number[]
  junction: number
  phase: 0 | 1
}

export interface StopSign {
  x: number
  z: number
  yaw: number
}

/** Off the curb onto the sidewalk. */
const BACK_OF_CURB = 1.1

/** The point `along` meters from p in direction d, and `right` meters to the driver's right of d. */
const step = (p: P2, d: P2, along: number, right: number): P2 => ({
  x: p.x + d.x * along - d.z * right,
  z: p.z + d.z * along + d.x * right,
})

/** Lane centers (meters right of the centerline) that one approach's heads hang over. */
function laneCenters(kind: 'avenue' | 'street'): number[] {
  return kind === 'avenue' ? [AVENUE.turn, AVENUE.lanes[0], AVENUE.lanes[1]] : [STREET.lane]
}

/** The mast arm for traffic arriving at junction `id` along the end `e`. */
function post(c: CityLayout, id: number, e: End, ends: End[]): SignalPost | null {
  const s = c.net.segments[e.seg]
  if (s.kind !== 'avenue' && s.kind !== 'street') return null
  const j = c.net.junctions[id]
  const out = leaves(s, e.start)
  const d = { x: -out.x, z: -out.z }
  // The way straight across, if any: the far side's corner is past its crosswalk.
  const across = ends
    .filter((o) => o !== e)
    .map((o) => ({ o, dir: leaves(c.net.segments[o.seg], o.start) }))
    .find((o) => o.dir.x * d.x + o.dir.z * d.z > 0.85)
  const reach = across
    ? across.o.mouth + CROSSWALK.to + 1.5
    : Math.max(...ends.map((o) => o.mouth)) + 2.5
  const half = across ? SECTION[c.net.segments[across.o.seg].kind].half : SECTION[s.kind].half
  const foot = step(j, d, reach, half + BACK_OF_CURB)
  const lanes = laneCenters(s.kind)
  // Facing the oncoming cars: the arm runs from the pole back over their lanes, to its left as they drive.
  const heads = lanes.map((v) => half + BACK_OF_CURB - v)
  return {
    ...foot,
    yaw: Math.atan2(-d.x, -d.z),
    arm: Math.max(...heads) + 0.8,
    heads,
    junction: id,
    phase: e.phase,
  }
}

/** Every mast-arm signal in the city. */
export function signalPosts(c: CityLayout): SignalPost[] {
  return c.junctions.flatMap((plan, id) =>
    plan.control === 'signal'
      ? plan.ends.map((e) => post(c, id, e, plan.ends)).filter((p): p is SignalPost => p !== null)
      : [],
  )
}

/** A stop sign at every approach to an all-way stop. */
export function stopSigns(c: CityLayout): StopSign[] {
  return c.junctions.flatMap((plan, id) =>
    plan.control !== 'stop'
      ? []
      : plan.ends.map((e) => {
          const s = c.net.segments[e.seg]
          const out = leaves(s, e.start)
          const j = c.net.junctions[id]
          // Driving in (against `out`), the right curb is on the left of `out`.
          const foot = step(j, out, e.mouth + CROSSWALK.bar + 0.6, -(SECTION[s.kind].half + 0.7))
          return { ...foot, yaw: Math.atan2(out.x, out.z) }
        }),
  )
}
