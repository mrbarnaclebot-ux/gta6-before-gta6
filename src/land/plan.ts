import { generateCity, inset, type CityLayout, type Grounded, type Rect } from '../city/layout'
import { emptyGrid, CELL, sampleGrid, type HeightGrid } from './grid'
import { buildHighway, EAST_X } from './highway'
import { buildHillside, HILL_ROAD_Z, LOOKOUT_R, type Villa } from './hillside'
import { DECK_FROM, type Path } from './path'
import { closest, type P2, type P3 } from './polyline'
import { AVENUE_Z, buildResidential, type House } from './residential'
import { bakeCoast, coastLine } from './coast'
import { carveWaterways, CANAL_FLOOR, planWaterways, type Waterways } from './waterways'
import { natural, type Frame } from './shape'
import { Shaper } from './stamp'
import { surfaceAt } from '../city/terrain'
import { stand, type Surface } from './footing'
import { SINK } from './plant'
import { OFFSHORE } from '../sea/offshore'

/*
 * The whole island as plain data: the city plan, every road outside it with its
 * height, houses and villas, and the baked terrain heightmap they are cut into.
 */

/** Ground under the paved city: below every slab and road, so it never shows through. */
export const UNDER_CITY = -0.6
export { CANAL_FLOOR } from './waterways'
/** Meters the terrain reaches over the sea east of the city. */
const EAST_SEA = 700
/** Seabed past the outermost coast on every side: the offshore current turns everyone back before its end. */
const SEA_MARGIN = OFFSHORE.full + 60

export interface Land extends CityLayout {
  frame: Frame
  ground: HeightGrid
  /** 0 to 255 per grid vertex: how much the ground reads as bare dirt. */
  dirt: Uint8Array
  paths: Path[]
  houses: House[]
  villas: Villa[]
  lookout: P3
  /** The city's greenery, set on the ground. */
  palms: Grounded[]
  bushes: Grounded[]
  lights: Grounded[]
  waterways: Waterways
}

function frameOf(c: CityLayout): Frame {
  const { land } = c
  const coast = coastLine()
  const { line } = coast
  // Whole cells out from the city, so grid vertices keep lining up with its edges.
  const out = (from: number, to: number) => Math.ceil(Math.max(0, to - from) / CELL) * CELL
  const xs = line.map((p) => p.x)
  const zs = line.map((p) => p.z)
  const grid: Rect = {
    x0: land.x0 - out(Math.min(...xs) - SEA_MARGIN, land.x0),
    x1: land.x1 + Math.max(EAST_SEA, out(land.x1, Math.max(...xs) + SEA_MARGIN)),
    z0: land.z0 - out(Math.min(...zs) - SEA_MARGIN, land.z0),
    z1: land.z1 + out(land.z1, Math.max(...zs) + SEA_MARGIN),
  }
  return { city: land, grid, coast: bakeCoast(grid, coast) }
}

/** Stamps every road and pad into the natural ground. */
function shape(
  g: HeightGrid,
  f: Frame,
  paths: Path[],
  houses: House[],
  villas: Villa[],
  lookout: P3,
) {
  const nat = new Float32Array(g.h.length)
  for (let i = 0; i <= g.nx; i++) {
    for (let j = 0; j <= g.nz; j++)
      nat[i * (g.nz + 1) + j] = natural(f, g.x0 + i * CELL, g.z0 + j * CELL)
  }
  const s = new Shaper(g, nat)
  for (const p of paths) {
    const pts = p.closed ? [...p.pts, p.pts[0]] : p.pts
    if (p.kind === 'trail') s.road(pts, p.width / 2 + 0.6, 3, 1)
    else s.road(pts, p.width / 2 + 3.5, 5, 0, p.kind === 'highway' || p.kind === 'ramp')
  }
  for (const p of paths.filter((q) => q.kind === 'loop'))
    s.pad(centerOf(p), radiusOf(p) + 4, 0, 0, 5)
  for (const h of houses) s.pad(h, h.w + 10, h.d + 12, h.yaw, 6)
  for (const v of villas) s.pad(v, v.w, v.d, v.yaw, 9)
  s.pad(lookout, LOOKOUT_R, 0, 0, 16)
  s.apply()
  return s.dirt
}

const centerOf = (p: Path): P3 => {
  const n = p.pts.length
  return {
    x: p.pts.reduce((a, q) => a + q.x, 0) / n,
    y: p.pts[0].y,
    z: p.pts.reduce((a, q) => a + q.z, 0) / n,
  }
}
const radiusOf = (p: Path) => Math.hypot(p.pts[0].x - centerOf(p).x, p.pts[0].z - centerOf(p).z)

/** The paved city sits on a hidden floor; the canal has its own, widened by most of a cell. */
function underCity(g: HeightGrid, c: CityLayout): void {
  const { land } = c
  const canal = inset(c.canal, -CELL * 0.6)
  for (let i = 0; i <= g.nx; i++) {
    for (let j = 0; j <= g.nz; j++) {
      const x = g.x0 + i * CELL
      const z = g.z0 + j * CELL
      if (!(x > land.x0 && x < land.x1 && z > land.z0 && z < land.z1)) continue
      const wet = x > canal.x0 && x < canal.x1 && z > canal.z0 && z < canal.z1
      g.h[i * (g.nz + 1) + j] = wet ? CANAL_FLOOR : UNDER_CITY
    }
  }
}

/**
 * Where a waterway's valley was cut under a road, earth ramps rebuild the road's approaches,
 * tapering off where it stands high: there it spans the water on a bridge.
 */
function abutments(g: HeightGrid, paths: Path[]): void {
  const crossing = paths.filter(
    (p) =>
      p.kind !== 'highway' &&
      p.kind !== 'ramp' &&
      p.pts.some((q) => q.y - sampleGrid(g, q.x, q.z) > DECK_FROM),
  )
  if (!crossing.length) return
  const s = new Shaper(g, g.h.slice())
  for (const p of crossing) s.road(p.pts, p.width / 2 + 3.5, 5, 0, true)
  s.apply()
}

/** Height of the nearest of these roads at p. */
const heightOn = (roads: Path[], p: P2) => {
  const best = roads.map((r) => ({ r, c: closest(r.pts, p) })).sort((a, b) => a.c.d - b.c.d)[0]
  return best.r.pts[best.c.i].y
}

/** The city's palms, ferns, and lamps set on the sidewalks, lawns, and sand they stand on. */
function settleCity(c: CityLayout, surface: Surface) {
  const on = (radius: number, sink: number) => (p: CityLayout['palms'][number]) => ({
    ...p,
    y: stand(surface, p.x, p.z, radius, sink),
  })
  return {
    palms: c.palms.map(on(0.3, SINK.palm)),
    bushes: c.bushes.map(on(0.1, SINK.bush)),
    lights: c.lights.map(on(0.2, 0)),
  }
}

/** Generates the city and everything around it, and bakes the terrain. Same seed, same world. */
export function generateLand(seed = 7, size = 1000): Land {
  // The city's street plan runs Hill Road and Palm Avenue out of its west edge at these z.
  const city = generateCity(seed, size)
  const frame = frameOf(city)
  const waterways = planWaterways(city, frame.coast)
  const ground = (x: number, z: number) => natural(frame, x, z)
  const home = buildResidential(ground, city.land.x0, waterways.river)
  const hills = buildHillside(ground, city.land.x0, home.trailhead)
  const boulevards = [hills.roads[0], home.roads[0]]
  const crossings = [HILL_ROAD_Z, AVENUE_Z].map((z) => {
    const at = { x: EAST_X, z }
    return { at, y: heightOn(boulevards, at) }
  })
  const beachRoad = city.net.lines.find((l) => l.name === 'coast road')!.pts[0].x
  const highway = buildHighway(
    ground,
    crossings,
    (p) => heightOn(boulevards, p),
    beachRoad,
    city.land.z1,
    waterways.channels.quays.filter((q) => q.z1 - q.z0 > q.x1 - q.x0),
  )
  const paths = [...highway, ...hills.roads, ...home.roads]
  const grid = emptyGrid(frame.grid)
  const dirt = shape(grid, frame, paths, home.houses, hills.villas, hills.lookout)
  underCity(grid, city)
  carveWaterways(grid, waterways)
  abutments(grid, paths)
  return {
    ...city,
    ...settleCity(city, (x, z) => surfaceAt({ ...city, ground: grid }, x, z)),
    frame,
    ground: grid,
    dirt: Uint8Array.from(dirt, (d) => Math.round(Math.min(1, d) * 255)),
    paths,
    houses: home.houses,
    villas: hills.villas,
    lookout: hills.lookout,
    waterways,
  }
}
