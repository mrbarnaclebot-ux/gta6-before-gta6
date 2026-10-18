import { rng, type Rand } from '../city/rng'
import { smoothstep } from './noise'
import { lift, path, WIDTH, type Path } from './path'
import { arc, closest, resample, stations, tangent, type P2, type P3 } from './polyline'
import { profile } from './profile'
import type { River } from './river'

/** Houses keep this far back from the river's channel: its banks and valley sides. */
const RIVER_VALLEY = 26

/*
 * Residential: Palm Avenue runs west from the city under the highway, swaying gently,
 * with curving side streets north and south that end in cul-de-sacs. Single-family
 * houses face every street, each on a level pad with a front yard, a driveway, and a
 * fenced back yard.
 */

export const AVENUE_Z = 300
const AVENUE_END = -1440
const CURVE_FROM = -700
const STREETS_X = [-790, -930, -1070, -1210]
const NORTH_LEN = 200
const SOUTH_LEN = 250
const BULB = 13
/** A street ends this far from the circle's middle, in the ring's inner lane: the ring covers its square end. */
const STREET_END = BULB - WIDTH.loop / 4
/** The street is level with its ring this far from the middle: past the flat pad and a cell more. */
const LEVEL = BULB + 8
/** House lots: spacing along the street, footprint range, and front setback from the curb. */
const LOT = { spacing: 25, setback: 8 }

type Ground = (x: number, z: number) => number

export const avenueZ = (x: number) =>
  AVENUE_Z + 45 * Math.sin((CURVE_FROM - x) / 170) * smoothstep(CURVE_FROM, CURVE_FROM - 120, x)

/** A cul-de-sac turning circle around the street's end, as a ring road. */
function bulb(end: P3, name: string): Path {
  return path(name, 'loop', lift(arc(end.x, end.z, BULB, 0, Math.PI * 2).slice(0, -1), end.y), true)
}

/**
 * A street and the turning circle at its end. The street stops inside the ring's inner lane:
 * run on to the circle's middle, its asphalt poked into the grass island; cut at the ring's
 * centerline, its square corners left a wedge of grass against the ring's outer edge. Its last
 * stretch levels out at the ring's height: plan.ts flattens the ground 4 m past the ring's
 * centerline at that height, which buried the end of a street still climbing to it.
 */
function deadEnd(name: string, kind: 'street' | 'avenue', sloped: P3[]): [Path, Path] {
  const end = sloped[sloped.length - 1]
  const off = (p: P3) => Math.hypot(p.x - end.x, p.z - end.z)
  const pts = sloped.map((p) => ({
    ...p,
    y: p.y + (end.y - p.y) * smoothstep(LEVEL + 12, LEVEL, off(p)),
  }))
  const k = pts.findIndex((p) => off(p) < STREET_END)
  const [a, b] = [pts[k - 1], pts[k]]
  const t = (off(a) - STREET_END) / (off(a) - off(b))
  const meet = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
  return [path(name, kind, [...pts.slice(0, k), meet]), bulb(end, `${name} circle`)]
}

function sideStreet(ground: Ground, at: P3, len: number, dir: 1 | -1, sway: number, name: string) {
  const pts = resample(
    Array.from({ length: 21 }, (_, k) => {
      const t = k / 20
      return { x: at.x + sway * Math.sin(t * Math.PI), z: at.z + dir * len * t }
    }),
    4,
  )
  const y = profile(pts, ground, { grade: 0.08, window: 60, start: at.y })
  return deadEnd(name, 'street', lift(pts, y))
}

/** A house: center, footprint (w across the front, d deep), yaw (front faces local +z), and pad height. */
export interface House extends P3 {
  w: number
  d: number
  yaw: number
  floors: 1 | 2
  /** Which side the garage is on, and a palette pick. */
  garage: -1 | 1
  tint: number
  roof: number
  /** Where the driveway meets the street. */
  curb: P2
}

/** Lots down both sides of one street, skipping the ends near junctions. */
function lotsAlong(road: Path, r: Rand): House[] {
  const st = stations(road.pts)
  const total = st[st.length - 1]
  const out: House[] = []
  for (let s = 28; s < total - 22; s += LOT.spacing) {
    const i = st.findIndex((v) => v >= s)
    const p = road.pts[i]
    const t = tangent(road.pts, i)
    for (const side of [1, -1] as const) {
      const w = 11 + Math.floor(r() * 4)
      const d = 9 + Math.floor(r() * 3)
      const back = road.width / 2 + LOT.setback + d / 2
      const n = { x: -t.z * side, z: t.x * side }
      const c = { x: p.x + n.x * back, z: p.z + n.z * back }
      out.push({
        ...c,
        y: p.y + 0.3,
        w,
        d,
        // Local +z must point back at the street: along -n.
        yaw: Math.atan2(-n.x, -n.z),
        floors: r() < 0.35 ? 2 : 1,
        garage: r() < 0.5 ? -1 : 1,
        tint: Math.floor(r() * 64),
        roof: Math.floor(r() * 4),
        curb: { x: p.x + n.x * (road.width / 2), z: p.z + n.z * (road.width / 2) },
      })
    }
  }
  return out
}

/** Drops houses that would sit on another road, in the river's valley, or crowd a house already kept. */
function clear(houses: House[], roads: Path[], river: River): House[] {
  const kept: House[] = []
  for (const h of houses) {
    const reach = Math.hypot(h.w, h.d) / 2 + 2
    const near = closest(river.pts, h)
    const wet = near.d < river.half[near.i] + RIVER_VALLEY + reach
    const onRoad = wet || roads.some((rd) => closest(rd.pts, h).d < rd.width / 2 + reach - 1)
    const crowded = kept.some((k) => Math.hypot(k.x - h.x, k.z - h.z) < 17)
    if (!onRoad && !crowded) kept.push(h)
  }
  return kept
}

export interface Residential {
  roads: Path[]
  houses: House[]
  /** The north side of the westmost north street's turning circle, where the forest trail comes in. */
  trailhead: P3
}

/** Palm Avenue from the city edge at `cityX`, its side streets, and the houses. */
export function buildResidential(ground: Ground, cityX: number, river: River): Residential {
  const line = resample(
    Array.from({ length: 81 }, (_, k) => {
      const x = cityX + ((AVENUE_END - cityX) * k) / 80
      return { x, z: avenueZ(x) }
    }),
    4,
  )
  const roads: Path[] = deadEnd(
    'Palm Avenue',
    'avenue',
    lift(line, profile(line, ground, { grade: 0.06, window: 120, start: 0 })),
  )
  const avenue = roads[0]
  STREETS_X.forEach((x, k) => {
    const at = avenue.pts[closest(avenue.pts, { x, z: avenueZ(x) }).i]
    const sway = (k % 2 ? 1 : -1) * 22
    roads.push(...sideStreet(ground, at, NORTH_LEN, -1, sway, `Street ${k + 1} North`))
    roads.push(...sideStreet(ground, at, SOUTH_LEN, 1, -sway, `Street ${k + 1} South`))
  })
  const r = rng(77)
  const streets = roads.filter((rd) => rd.kind !== 'loop')
  // Houses face the avenue only west of the highway's ramps.
  const all = streets.flatMap((rd) => lotsAlong(rd, r)).filter((h) => h.x < CURVE_FROM - 20)
  // The trail comes in from the north and meets the westmost north circle's ring there.
  const ring = roads.find((rd) => rd.name === `Street ${STREETS_X.length} North circle`)!
  const trailhead = ring.pts.reduce((a, b) => (b.z < a.z ? b : a))
  return { roads, houses: clear(all, roads, river), trailhead }
}
