import { CURB_H, type CityLayout, type Rect } from './layout'
import { rng } from './rng'

/*
 * Street furniture along the city's sidewalks: hydrants by the curb, benches with a bin,
 * parking meters, newspaper boxes near corners, bus stops, and signs. Pure data; the models
 * are in world/furniture-models.ts. Nothing lands within reach of a palm or streetlight.
 */

export type FurnitureKind = 'bench' | 'bin' | 'hydrant' | 'meter' | 'news' | 'bus' | 'sign'

export interface Furniture {
  kind: FurnitureKind
  x: number
  y: number
  z: number
  /** Yaw: the item's front (+z) faces the road. */
  r: number
  /** Variant: color pick for newspaper boxes and signs, ad picture for bus stops. */
  v: number
}

type Edge = 'x0' | 'x1' | 'z0' | 'z1'
const EDGES: Edge[] = ['x0', 'x1', 'z0', 'z1']
const OUTWARD: Record<Edge, number> = { x0: -Math.PI / 2, x1: Math.PI / 2, z0: Math.PI, z1: 0 }
/**
 * Meters from the curb: curbside things, things that face the street from the back, and the
 * bus shelter (1.7 m deep). All stay curbward of the people walking 3 m in (life/places.ts).
 */
const CURBSIDE = 0.7
const BACK = 2.1
const SHELTER = 1.75
const KEEP_CLEAR = 1.6
/** The shelter is 3.7 m long: a lamp or palm anywhere along it would stand inside. */
const SHELTER_CLEAR = 2.4

/** What goes along one sidewalk edge, at distances along it (meters from its start). */
function plan(len: number, r: () => number, busy: boolean): [FurnitureKind, number][] {
  const out: [FurnitureKind, number][] = [['hydrant', 6 + r() * 4]]
  if (r() < 0.6) out.push(['news', len - 5 - r() * 2], ['news', len - 5.8 - r() * 2])
  const bus = r() < 0.25 && len > 60
  if (bus) out.push(['bus', len * 0.5])
  else out.push(['bench', len * 0.4], ['bin', len * 0.4 + 1.6])
  // No meter under the shelter's roof.
  const free = (t: number) => !bus || Math.abs(t - len * 0.5) > SHELTER_CLEAR
  if (busy) for (let t = 16; t < len - 10; t += 9) if (free(t)) out.push(['meter', t + r()])
  if (r() < 0.5) out.push(['sign', len * 0.75])
  return out
}

/** Point `along` meters down an edge of `rect`, `inward` meters in from the curb. */
function at(rect: Rect, e: Edge, along: number, inward: number) {
  const sign = e[1] === '0' ? 1 : -1
  const fixed = rect[e] + sign * inward
  return e[0] === 'z' ? { x: rect.x0 + along, z: fixed } : { x: fixed, z: rect.z0 + along }
}

/** Street furniture on every block's sidewalks, kept clear of `avoid` (palms and lights). */
export function furnitureFor(c: CityLayout, avoid: { x: number; z: number }[]): Furniture[] {
  const r = rng(c.seed * 31 + 5)
  const clear = (p: { x: number; z: number }, d: number) =>
    avoid.every((a) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 > d ** 2)
  const out: Furniture[] = []
  for (const b of c.blocks) {
    const busy = b.district === 'downtown' || b.district === 'midtown'
    for (const e of EDGES) {
      const canal = (b.canalSide === 'east' && e === 'x1') || (b.canalSide === 'west' && e === 'x0')
      const len = e[0] === 'z' ? b.rect.x1 - b.rect.x0 : b.rect.z1 - b.rect.z0
      if (canal || len < 30) continue
      for (const [kind, along] of plan(len, r, busy)) {
        const back = kind === 'bench' || kind === 'bin' || kind === 'news'
        const p = at(b.rect, e, along, kind === 'bus' ? SHELTER : back ? BACK : CURBSIDE)
        if (!clear(p, kind === 'bus' ? SHELTER_CLEAR : KEEP_CLEAR)) continue
        out.push({ kind, ...p, y: CURB_H, r: OUTWARD[e], v: Math.floor(r() * 4) })
      }
    }
  }
  return out
}
