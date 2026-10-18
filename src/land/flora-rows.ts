import { HOUSE_DESIGNS } from './house-designs'
import type { Grounded } from '../city/layout'
import { range, rng } from '../city/rng'
import { BLOCKED, clearAt, type Clearance } from './clearance'
import { SINK, tint, upright } from './plant'
import type { Surface } from './footing'
import type { Land } from './plan'
import { offset } from './polyline'

/** Palms line the avenues and the coast road this far apart, just off the curb. */
const PALM_GAP = 17
const PALM_OUT = 2.4
/** Hedge bushes this far apart along a front yard, set back from the curb. */
const HEDGE_GAP = 0.9
const HEDGE_BACK = 3.5

/** Rows of palms down both sides of the avenues and the coast roads, where nothing else stands. */
export function avenuePalms(land: Land, tight: Clearance, surface: Surface): Grounded[] {
  const r = rng(651)
  const out: Grounded[] = []
  for (const p of land.paths.filter((q) => q.kind === 'avenue' || q.kind === 'coast')) {
    for (const side of [1, -1]) {
      const row = offset(p.pts, side * (p.width / 2 + PALM_OUT))
      const every = Math.round(PALM_GAP / 4)
      for (let i = every; i < row.length - every; i += every) {
        if (clearAt(tight, row[i].x, row[i].z) === BLOCKED) continue
        out.push(upright(surface, row[i], range(r, 8, 12), 0.3, SINK.palm, r))
      }
    }
  }
  return out
}

/**
 * A low hedge of bushes across the front of about half the house yards, broken by the drive.
 * A corner lot's hedge would run on into the side street, so it stops at the road's verge.
 */
export function hedges(land: Land, tight: Clearance, surface: Surface): Grounded[] {
  const r = rng(661)
  const out: Grounded[] = []
  for (const h of land.houses) {
    // Houses with a garden wall or picket fence of their own get no hedge in front of it.
    if (r() > 0.55 || HOUSE_DESIGNS[h.design].frontWall) continue
    const cos = Math.cos(h.yaw)
    const sin = Math.sin(h.yaw)
    const lz = (h.curb.x - h.x) * sin + (h.curb.z - h.z) * cos - HEDGE_BACK
    const gx = h.garage * (h.w / 2 - 2.2)
    for (let lx = -h.w / 2 - 2.5; lx <= h.w / 2 + 2.5; lx += HEDGE_GAP) {
      if (Math.abs(lx - gx) < 2.8) continue
      const p = { x: h.x + lx * cos + lz * sin, z: h.z - lx * sin + lz * cos }
      if (clearAt(tight, p.x, p.z) === BLOCKED) continue
      const s = range(r, 1.1, 1.5)
      out.push({ ...upright(surface, p, s, 0.12 * s, SINK.bush, r), tint: tint(r, 0.4) })
    }
  }
  return out
}
