import * as THREE from 'three'
import { segLength } from '../city/faces'
import { CROSSWALK, endOf, type JunctionPlan } from '../city/junctions'
import { CURB_H, type CityLayout } from '../city/layout'
import type { Segment } from '../city/network'
import { bayLines } from '../city/parking-lots'
import { BAY_LENGTH, curbBays } from '../city/parking'
import { closest } from '../land/polyline'
import { AVENUE, SECTION, STREET } from '../city/streets'
import type { Land } from '../land/plan'
import { wornPaint } from '../render/road-wear'
import type { WorldCtx } from './blocks'
import { AHEAD, LEFT, Paint } from './paint'

/*
 * The city's road paint, one draw call: double yellow center lines, dashed lane lines on the
 * avenues, the left-turn lane where each median gives way, turn and straight arrows, stop
 * bars at lights and stop signs, zebra crosswalks, parking-lane lines with bay ticks, and
 * the bays in the parking lots.
 */

const WHITE = new THREE.Color(0xe8e6df)
const YELLOW = new THREE.Color(0xd9a520)
const LINE = 0.12

type City = Land

const held = (p: JunctionPlan) => p.control === 'signal' || p.control === 'stop'

/** Where paint along the segment starts and ends: past the stop bars, or right at a plain junction. */
function paintSpan(c: CityLayout, seg: number): [number, number] {
  const at = (start: boolean) => {
    const s = c.net.segments[seg]
    const plan = c.junctions[start ? s.a : s.b]
    const end = endOf(c.junctions, c.net, seg, start)
    return held(plan) ? end.mouth + CROSSWALK.bar + CROSSWALK.barWidth : end.mouth
  }
  return [at(true), segLength(c.net.segments[seg]) - at(false)]
}

/** Zebra bars across the street and the stop bar over the lanes arriving, at one end. */
function crossing(
  p: Paint,
  c: CityLayout,
  seg: number,
  start: boolean,
  line: Segment['pts'],
  len: number,
) {
  const s = c.net.segments[seg]
  const half = SECTION[s.kind].half - 0.6
  const m = endOf(c.junctions, c.net, seg, start).mouth
  // u runs a to b; at the start the crosswalk lies at small u, at the end near len.
  const u = (d: number) => (start ? d : len - d)
  const [c0, c1] = [u(m + CROSSWALK.from), u(m + CROSSWALK.to)].sort((a, b) => a - b)
  for (let v = -half; v + 0.5 <= half; v += 1.1) p.band(line, c0, c1, v, v + 0.55, WHITE)
  const [b0, b1] = [u(m + CROSSWALK.bar), u(m + CROSSWALK.bar + CROSSWALK.barWidth)].sort(
    (a, b) => a - b,
  )
  // Arriving traffic at the end drives a to b (driver's right is +v); at the start, b to a.
  const inner = s.kind === 'avenue' ? AVENUE.turn - 1.65 : 0
  if (start) p.band(line, b0, b1, -half, -inner, WHITE)
  else p.band(line, b0, b1, inner, half, WHITE)
}

/** Center line, lane lines, and turn lanes of an avenue segment. */
function avenue(
  p: Paint,
  c: City,
  seg: number,
  line: Segment['pts'],
  u0: number,
  u1: number,
  step: number,
) {
  const median = c.medians.find((m) => m.seg === seg)
  for (const s of [1, -1]) p.dashes(line, u0, u1, s * 5.3, LINE, 3, 9, WHITE)
  const bayA = median ? median.s0 : (u0 + u1) / 2
  const bayB = median ? median.s1 : (u0 + u1) / 2
  const s = c.net.segments[seg]
  // Near the end the a-to-b traffic has the turn lane (v from -1.3 to 2); near the start, b-to-a.
  const ends: [boolean, number, number, 1 | -1][] = [
    [held(c.junctions[s.b]), bayB, u1, 1],
    [held(c.junctions[s.a]), u0, bayA, -1],
  ]
  for (const [stops, from, to, k] of ends) {
    if (to - from < 0.5) continue
    if (!stops) {
      p.band(line, from, to, -0.18, -0.06, YELLOW, step)
      p.band(line, from, to, 0.06, 0.18, YELLOW, step)
      continue
    }
    p.band(line, from, to, k * -1.36, k * -1.24, YELLOW, step)
    p.band(line, from, to, k * 2.0, k * 2.12, WHITE, step)
    if (to - from < 8) continue
    const u = k > 0 ? to - 6 : from + 6
    p.glyph(line, u, k * AVENUE.turn, k > 0 ? LEFT : turned(LEFT), WHITE)
    p.glyph(line, u, k * AVENUE.lanes[1], k > 0 ? AHEAD : turned(AHEAD), WHITE)
  }
}

/** A glyph turned round, for traffic going the other way. */
const turned = (g: [number, number][][]) =>
  g.map((t) => t.map(([du, dv]) => [-du, -dv] as [number, number]))

/** Bay stations split where a driveway left a gap: each run is painted on its own. */
function runs(us: number[]): number[][] {
  const pitch = Math.min(...us.slice(1).map((u, k) => u - us[k]))
  const out: number[][] = []
  for (const [k, u] of us.entries()) {
    if (k && u - us[k - 1] < pitch * 1.5) out[out.length - 1].push(u)
    else out.push([u])
  }
  return out
}

/** Double yellow, the parking lanes' lines, and a tick at each end of every bay. */
function street(
  p: Paint,
  c: City,
  seg: number,
  line: Segment['pts'],
  u0: number,
  u1: number,
  step: number,
) {
  p.band(line, u0, u1, -0.18, -0.06, YELLOW, step)
  p.band(line, u0, u1, 0.06, 0.18, YELLOW, step)
  for (const side of [1, -1] as const) {
    const bays = curbBays(c, seg, side)
    if (!bays.length) continue
    const v = side * (STREET.lane * 2 + 0.05)
    const curb = side * (SECTION.street.half - 0.5)
    const us = bays.map((b) => closest(line, b).s).sort((a, b) => a - b)
    for (const run of runs(us)) {
      const [a, b] = [run[0] - BAY_LENGTH / 2, run[run.length - 1] + BAY_LENGTH / 2]
      p.band(line, a, b, v - LINE / 2, v + LINE / 2, WHITE, step)
      const ticks = [a, ...run.slice(1).map((u, k) => (u + run[k]) / 2), b]
      for (const u of ticks)
        p.band(line, u - LINE / 2, u + LINE / 2, Math.min(v, curb), Math.max(v, curb), WHITE)
    }
  }
}

/** Paint for every street segment and every parking lot. */
function paintAll(c: City): THREE.BufferGeometry {
  const p = new Paint(c)
  c.net.segments.forEach((s, seg) => {
    if (s.kind !== 'avenue' && s.kind !== 'street') return
    const len = segLength(s)
    const [u0, u1] = paintSpan(c, seg)
    const onCanal = (j: number) =>
      c.net.junctions[j].segs.some((k) => c.net.segments[k].kind === 'canal')
    // Over a canal hump the paint must follow the rise closely.
    const step = onCanal(s.a) || onCanal(s.b) ? 1 : 4
    if (u1 > u0) (s.kind === 'avenue' ? avenue : street)(p, c, seg, s.pts, u0, u1, step)
    if (held(c.junctions[s.a])) crossing(p, c, seg, true, s.pts, len)
    if (held(c.junctions[s.b])) crossing(p, c, seg, false, s.pts, len)
  })
  // Lots stand on the block, at the curb's height and a hair over their asphalt.
  p.base = CURB_H + 0.004
  for (const lot of c.blocks.flatMap((b) => b.parking)) {
    for (const [a, b] of bayLines(lot))
      p.band([a, b], 0, Math.hypot(b.x - a.x, b.z - a.z), -0.06, 0.06, WHITE)
  }
  return p.geometry()
}

/** Every painted line in the city, in one draw call. */
export function buildMarkings(ctx: WorldCtx, c: City): void {
  const material = wornPaint(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.75,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  )
  const mesh = new THREE.Mesh(paintAll(c), material)
  mesh.receiveShadow = true
  mesh.matrixAutoUpdate = false
  ctx.scene.add(mesh)
}
