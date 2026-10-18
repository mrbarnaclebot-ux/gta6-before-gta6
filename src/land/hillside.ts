import { lift, path, WIDTH, type Path } from './path'
import { arc, chain, closest, resample, spline, type P2, type P3 } from './polyline'
import { profile } from './profile'
import { HILLS } from './shape'

/*
 * Hillside: Hill Road leaves the city westward, then climbs the hill in switchbacks:
 * arcs around the summit at shrinking radii, joined by hairpins on the south-east face,
 * which looks back at the skyline. Villas sit on terraces on the downhill side of each
 * arc. A dirt trail runs from the summit lookout into the forest.
 */

const HILL = HILLS[0]
export const HILL_ROAD_Z = -300
/** Where Hill Road ends and the switchbacks start: on the first arc. */
const START = { x: -850, z: HILL_ROAD_Z }
const LEG_GAP = 72
const HAIRPIN = LEG_GAP / 2
// The arcs swing between these angles around the summit (0 is east, pi/2 is south).
const THETA_A = 0.17
const THETA_B = 1.4
export const LOOKOUT_R = 46
/** Villas: spacing along the arc, how far out from the road, and the pad size. */
const VILLA = { spacing: 62, out: 20, w: 30, d: 22 }
/** Meters from a villa terrace's middle, straight out of its front, to the road's edge. */
export const VILLA_ROAD = VILLA.out - WIDTH.hill / 2

export type Ground = (x: number, z: number) => number

const u = (t: number): P2 => ({ x: Math.cos(t), z: Math.sin(t) })
const around = (r: number, t: number): P2 => ({
  x: HILL.x + r * Math.cos(t),
  z: HILL.z + r * Math.sin(t),
})

/** Half a circle from radius r to r - LEG_GAP at angle t, bulging toward +t (sign 1) or -t (sign -1). */
function hairpin(r: number, t: number, sign: 1 | -1): P2[] {
  const q = around(r - HAIRPIN, t)
  const n = u(t)
  const tan = { x: -Math.sin(t) * sign, z: Math.cos(t) * sign }
  return Array.from({ length: 29 }, (_, k) => {
    const f = (Math.PI * k) / 28
    return {
      x: q.x + HAIRPIN * (Math.cos(f) * n.x + Math.sin(f) * tan.x),
      z: q.z + HAIRPIN * (Math.cos(f) * n.z + Math.sin(f) * tan.z),
    }
  })
}

/** The radii of the five arcs, outermost first. */
export function legRadii(): number[] {
  const r0 = Math.hypot(START.x - HILL.x, START.z - HILL.z)
  return Array.from({ length: 5 }, (_, k) => r0 - k * LEG_GAP)
}

function switchbackLine(): P2[] {
  const r = legRadii()
  const t0 = Math.atan2(START.z - HILL.z, START.x - HILL.x)
  const leg = (k: number, a: number, b: number) => arc(HILL.x, HILL.z, r[k], a, b)
  return resample(
    chain(
      leg(0, t0, THETA_B),
      hairpin(r[0], THETA_B, 1),
      leg(1, THETA_B, THETA_A),
      hairpin(r[1], THETA_A, -1),
      leg(2, THETA_A, THETA_B),
      hairpin(r[2], THETA_B, 1),
      leg(3, THETA_B, THETA_A),
      hairpin(r[3], THETA_A, -1),
      leg(4, THETA_A, THETA_B),
      [around(LOOKOUT_R - 8, THETA_B)],
    ),
    4,
  )
}

/** A villa on a level terrace: center, size, yaw (front faces the road, local +z), and floor height. */
export interface Villa extends P3 {
  w: number
  d: number
  yaw: number
  seed: number
}

function villas(road: Path): Villa[] {
  const r = legRadii()
  const out: Villa[] = []
  for (let k = 0; k < 4; k++) {
    const t0 = k === 0 ? Math.atan2(START.z - HILL.z, START.x - HILL.x) : THETA_A
    const step = VILLA.spacing / r[k]
    for (let t = t0 + 0.15; t < THETA_B - 0.14; t += step) {
      const c = around(r[k] + VILLA.out, t)
      const y = road.pts[closest(road.pts, around(r[k], t)).i].y + 0.4
      out.push({
        ...c,
        y,
        w: VILLA.w,
        d: VILLA.d,
        yaw: -t - Math.PI / 2,
        seed: out.length * 7919 + k,
      })
    }
  }
  return out
}

/** Dirt trail from the lookout over the forest hill, down to `end` (a residential cul-de-sac). */
function trail(ground: Ground, from: P3, end: P3): Path {
  const ctrl = [
    around(LOOKOUT_R - 6, Math.PI),
    { x: -1300, z: -600 },
    { x: -1420, z: -575 },
    { x: -1500, z: -470 },
    { x: -1530, z: -340 },
    { x: -1480, z: -232 },
    { x: -1392, z: -214 },
    { x: -1334, z: -142 },
    { x: -1290, z: -40 },
    end,
  ]
  const pts = spline(ctrl, 4)
  const y = profile(pts, ground, { grade: 0.3, window: 24, start: from.y, end: end.y })
  return path('forest trail', 'trail', lift(pts, y))
}

export interface Hillside {
  roads: Path[]
  villas: Villa[]
  /** The level lookout on the summit. */
  lookout: P3
}

/** Hill Road from the city edge at `cityX`, the switchbacks, the villas, and the trail to `trailEnd`. */
export function buildHillside(ground: Ground, cityX: number, trailEnd: P3): Hillside {
  const blvd = resample([{ x: cityX, z: HILL_ROAD_Z }, START], 4)
  const by = profile(blvd, ground, { grade: 0.06, window: 120, start: 0 })
  const hillRoad = path('Hill Road', 'avenue', lift(blvd, by))
  const line = switchbackLine()
  // The lookout sits within a few meters of the natural summit, so the hill keeps its crown,
  // but no higher than the road can climb to without towering over the slope below it.
  const grade = { grade: 0.085, window: 120, start: by[by.length - 1] }
  const free = profile(line, ground, grade).at(-1)!
  const lookout = { x: HILL.x, y: Math.max(free, ground(HILL.x, HILL.z) - 5), z: HILL.z }
  const climb = path(
    'Hillside Drive',
    'hill',
    lift(line, profile(line, ground, { ...grade, end: lookout.y })),
  )
  return {
    roads: [hillRoad, climb, trail(ground, lookout, trailEnd)],
    villas: villas(climb),
    lookout,
  }
}
