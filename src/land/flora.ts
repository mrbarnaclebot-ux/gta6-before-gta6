import { SEA_LEVEL, type Grounded } from '../city/layout'
import { range, rng } from '../city/rng'
import { surfaceAt } from '../city/terrain'
import { BLOCKED, clearance, clearAt, FREE, YARD, type Clearance } from './clearance'
import { forestAt } from './districts'
import { lie, upAt, type Surface } from './footing'
import { gridRect, slopeAt } from './grid'
import { fbm, smoothstep } from './noise'
import type { Land } from './plan'
import { poissonOver } from './poisson'
import { coastX } from './shape'
import { avenuePalms, hedges } from './flora-rows'
import { ROCK_RIM, ROCK_SPREAD, SINK, tint, TRUNK, upright } from './plant'

/*
 * Every tree, bush, and rock outside the city, as pure data: Poisson-disk points thinned
 * by biome (forest, hills, groves in the fields, gardens, the coast), kept off roads,
 * buildings, and water, each set on the ground by land/footing.ts.
 */

export interface Flora {
  conifers: Grounded[]
  broadleaf: Grounded[]
  garden: Grounded[]
  palms: Grounded[]
  bushes: Grounded[]
  rocks: Grounded[]
  /** Where plants may grow, for the grass drawn around the camera. */
  clear: Clearance
}

/** What grows here depends on these. */
export interface Site {
  y: number
  forest: number
  hill: number
  slope: number
  /** Meters seaward of the coast line: negative inland. */
  coast: number
  /** Copses in the open fields. */
  grove: number
  clear: number
}

export function siteAt(land: Land, c: Clearance, x: number, z: number): Site {
  const forest = forestAt(x, z)
  const y = surfaceAt(land, x, z)
  return {
    y,
    forest,
    hill: smoothstep(16, 48, y),
    slope: slopeAt(land.ground, x, z),
    coast: x - coastX(land.frame, z),
    grove: smoothstep(0.12, 0.42, fbm(x / 260, z / 260, 71, 3)) * (1 - forest),
    clear: clearAt(c, x, z),
  }
}

const wet = (s: Site) => s.y < SEA_LEVEL + 0.6

/** Forest, hill, and grove trees: firs where it is wild, broadleaves mixed in, copses in the fields. */
function trees(land: Land, c: Clearance, surface: Surface, out: Flora) {
  const r = rng(601)
  for (const p of poissonOver(gridRect(land.ground), 5.4, 602)) {
    const s = siteAt(land, c, p.x, p.z)
    if (s.clear !== FREE || s.coast > -14 || s.slope > 0.85 || wet(s)) continue
    const wc = 0.9 * s.forest + 0.35 * s.hill * (1 - s.forest)
    const wb = 0.16 * s.forest + 0.2 * s.hill + 0.5 * s.grove
    if (r() >= Math.min(0.95, wc + wb)) continue
    const conifer = r() * (wc + wb) < wc
    const h = conifer ? range(r, 13, 24) : range(r, 8, 15)
    const list = conifer ? out.conifers : out.broadleaf
    list.push(upright(surface, p, h, TRUNK * h, SINK.tree, r))
  }
}

/** Garden trees and the odd palm in the house yards. */
function gardens(land: Land, c: Clearance, surface: Surface, out: Flora) {
  const r = rng(611)
  for (const p of poissonOver(gridRect(land.ground), 7.5, 612)) {
    if (clearAt(c, p.x, p.z) !== YARD || r() > 0.42) continue
    if (r() < 0.25) out.palms.push(upright(surface, p, range(r, 6, 10), 0.3, SINK.palm, r))
    else {
      const h = range(r, 4.5, 8)
      out.garden.push(upright(surface, p, h, TRUNK * h * 1.5, SINK.tree, r))
    }
  }
}

/** Palms scattered behind the beach, beyond the city's own rows. */
function coastPalms(land: Land, c: Clearance, surface: Surface, out: Flora) {
  const r = rng(621)
  for (const p of poissonOver(gridRect(land.ground), 11, 622)) {
    const s = siteAt(land, c, p.x, p.z)
    if (s.clear !== FREE || s.coast < -45 || s.coast > 4 || wet(s) || r() > 0.4) continue
    out.palms.push(upright(surface, p, range(r, 8, 13), 0.3, SINK.palm, r))
  }
}

/** Bushes: garden shrubs, forest and hill undergrowth, the edges of copses, the back of the beach. */
function bushes(land: Land, c: Clearance, surface: Surface, out: Flora) {
  const r = rng(631)
  for (const p of poissonOver(gridRect(land.ground), 3, 632)) {
    const s = siteAt(land, c, p.x, p.z)
    if (s.clear === BLOCKED || s.coast > -6 || s.slope > 1 || wet(s)) continue
    const back = s.coast > -30 ? 0.06 : 0
    const w =
      s.clear === YARD ? 0.2 : 0.1 * s.forest + 0.12 * s.hill + 0.16 * s.grove + 0.015 + back
    if (r() >= w) continue
    const h = range(r, 0.9, 2.2)
    out.bushes.push(upright(surface, p, h, 0.12 * h, SINK.bush, r))
  }
}

/** Rocks where the ground is steep, a few strewn through the woods; they lie with the slope. */
function rocks(land: Land, c: Clearance, surface: Surface, out: Flora) {
  const r = rng(641)
  for (const p of poissonOver(gridRect(land.ground), 8, 642)) {
    const s = siteAt(land, c, p.x, p.z)
    if (s.clear !== FREE || s.coast > -10 || wet(s)) continue
    const w = 0.6 * smoothstep(0.35, 0.9, s.slope) + 0.04 * s.forest + 0.05 * s.hill
    if (r() >= w) continue
    const h = range(r, 0.5, 2)
    const up = upAt(surface, p.x, p.z, h * ROCK_SPREAD)
    const y = lie(surface, p.x, p.z, h * ROCK_SPREAD * ROCK_RIM, up) - SINK.rock * h
    out.rocks.push({ x: p.x, z: p.z, s: h, r: r() * Math.PI * 2, y, up, tint: tint(r, 0.6) })
  }
}

/** Every plant and rock outside the city, set on the ground. Same land, same flora. */
export function generateFlora(land: Land): Flora {
  const c = clearance(land)
  const surface: Surface = (x, z) => surfaceAt(land, x, z)
  const out: Flora = {
    ...{ conifers: [], broadleaf: [], garden: [], palms: [], bushes: [], rocks: [] },
    clear: c,
  }
  trees(land, c, surface, out)
  gardens(land, c, surface, out)
  coastPalms(land, c, surface, out)
  bushes(land, c, surface, out)
  rocks(land, c, surface, out)
  out.palms.push(...avenuePalms(land, surface))
  out.bushes.push(...hedges(land, surface))
  return out
}
