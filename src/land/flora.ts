import { SEA_LEVEL, type Grounded } from '../city/layout'
import { range, rng } from '../city/rng'
import { surfaceAt } from '../city/terrain'
import { clearance, clearAt, FREE, VERGE_STRIP, YARD, type Clearance } from './clearance'
import { forestAt } from './districts'
import { lie, upAt, type Surface } from './footing'
import { gridRect, slopeAt } from './grid'
import { fbm, smoothstep } from './noise'
import type { Land } from './plan'
import { LOOKOUT_R } from './hillside'
import { poissonOver } from './poisson'
import { dist } from './polyline'
import { seaward } from './coast'
import { LAKE, pastShore } from './lake'
import { avenuePalms, hedges } from './flora-rows'
import { shoreRocks } from './shore-rocks'
import { GARDEN_TRUNK, ROCK_RIM, ROCK_SPREAD, SINK, tint, TRUNK, upright } from './plant'

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
  /** Meters past the lake's shore: negative over its water. */
  lake: number
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
    coast: seaward(land.frame.coast, x, z),
    grove: smoothstep(0.12, 0.42, fbm(x / 260, z / 260, 71, 3)) * (1 - forest),
    clear: clearAt(c, x, z),
    lake: pastShore(LAKE, x, z),
  }
}

const wet = (s: Site) => s.y < SEA_LEVEL + 0.6 || s.lake < 3

/** Forest, hill, and grove trees: firs where it is wild, broadleaves mixed in, copses in the fields. */
function trees(land: Land, c: Clearance, surface: Surface, out: Flora) {
  const r = rng(601)
  for (const p of poissonOver(gridRect(land.ground), 5.4, 602)) {
    const s = siteAt(land, c, p.x, p.z)
    if (s.clear !== FREE || s.coast > -14 || s.slope > 0.85 || wet(s)) continue
    const wc = 0.9 * s.forest + 0.35 * s.hill * (1 - s.forest)
    const wb = 0.16 * s.forest + 0.2 * s.hill + 0.5 * s.grove
    // The summit is a meadow, so the lookout sees over the woods to the city and the forest.
    const crown = smoothstep(LOOKOUT_R + 25, LOOKOUT_R + 150, dist(p, land.lookout))
    if (r() >= Math.min(0.95, wc + wb) * crown) continue
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
      const h = range(r, 3.5, 6)
      out.garden.push(upright(surface, p, h, GARDEN_TRUNK * h, SINK.tree, r))
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
    if (s.clear >= VERGE_STRIP || s.coast > -6 || s.slope > 1 || wet(s)) continue
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
  out.rocks.push(...shoreRocks(land, c, surface))
  // Roadside rows keep only a narrow verge clear: the full one would empty them.
  const tight = clearance(land, 1.5)
  out.palms.push(...avenuePalms(land, tight, surface))
  out.bushes.push(...hedges(land, tight, surface))
  return out
}
