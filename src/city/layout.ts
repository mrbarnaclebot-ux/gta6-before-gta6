import { buildingsFor, type Building, type Parcels } from './lots'
import { greenery, type Grounded, type Spot } from './greenery'
import { pick, rng } from './rng'
import { buildNetwork, type Network } from './network'
import { faceOutline, type Outline, type SideKind } from './faces'
import { area, bounds, centroid, insetRing, type Ring } from './polygon'
import { streetPlan } from './street-plan'
import { CANAL_HALF, SECTION } from './streets'
import { canalBridges, type Bridge } from './canal-bridge'
import { promenadeLawns } from './promenade'
import { junctionPlans, type JunctionPlan } from './junctions'
import { medians as mediansOf, type Median } from './medians'
import { drivewaysOf, type Driveway } from './parking-lots'

/*
 * Seeded city plan: pure data, no three.js. The renderer and physics both read it, so what
 * you see is exactly what you collide with. Streets are drawn by hand (street-plan.ts) and
 * become a planar network; its faces are the blocks with their sidewalks and lots, the
 * paved walks along the city's edge and the beach, and small traffic islands.
 */

export { CANAL_HALF }
export const SEA_LEVEL = -1.2
export const CURB_H = 0.15

export interface Rect {
  x0: number
  z0: number
  x1: number
  z1: number
}

export type District = 'downtown' | 'midtown' | 'deco' | 'beachfront'

/** A raised paved face: its curb line, what lies beyond each piece of it, and its bounds. */
export interface Face {
  curb: Ring
  sides: SideKind[]
  /** Network segment beyond each piece of the curb, -1 on corners. */
  segs: number[]
  box: Rect
}

export interface Block extends Face, Parcels {
  /** The lot line: the curb moved in by the sidewalk. */
  lot: Ring
  lotSides: SideKind[]
  district: District
  park: boolean
}

export interface CityLayout {
  seed: number
  size: number
  net: Network
  blocks: Block[]
  /** Paved faces with no lots: the edge walks and the beach promenade. */
  walks: Face[]
  /** Small planted islands left between crossing streets. */
  islands: Face[]
  /** Outer edge of the paved city; terrain and sand start here. */
  land: Rect
  canal: Rect
  /** Streets that hump over the canal. */
  bridges: Bridge[]
  /** Lawn strips in the beach promenade. */
  promenade: Ring[]
  /** Planted medians down the avenues. */
  medians: Median[]
  /** How each junction works: traffic control, and where each street's mouth is. */
  junctions: JunctionPlan[]
  palms: Spot[]
  bushes: Spot[]
  lights: Spot[]
  /** Curb cuts into parking lots and garages. */
  driveways: Driveway[]
  spawn: { x: number; z: number }
}

export type { Building, Grounded, Spot }

export const inset = (r: Rect, by: number): Rect => ({
  x0: r.x0 + by,
  z0: r.z0 + by,
  x1: r.x1 - by,
  z1: r.z1 - by,
})

/** Palms and lamps a car's width either side of a driveway are left out. */
function clearOfDriveways<T extends Record<string, Spot[]>>(g: T, cuts: Driveway[]): T {
  const free = (p: Spot) => cuts.every((d) => Math.hypot(p.x - d.x, p.z - d.z) > d.w / 2 + 2.5)
  return Object.fromEntries(Object.entries(g).map(([k, list]) => [k, list.filter(free)])) as T
}

/** Islands: faces too small for a lot. */
const ISLAND_AREA = 400

function district(o: Outline, net: Network): District {
  const coast = o.segs.some((s) => s >= 0 && net.lines[net.segments[s].line].name === 'coast road')
  if (coast) return 'beachfront'
  const { x } = centroid(o.ring)
  if (x > 0) return 'deco'
  return x > -250 ? 'midtown' : 'downtown'
}

type Plain = Omit<Block, 'buildings' | 'gardens' | 'plazas' | 'parking' | 'park'>

/** Curb and lot outlines for every face, sorted into blocks, walks, and islands. */
function sortFaces(net: Network) {
  const blocks: Plain[] = []
  const walks: Face[] = []
  const islands: Face[] = []
  for (const f of net.faces) {
    const curb = faceOutline(net, f, (k) => SECTION[k].half, true)
    const face: Face = {
      curb: curb.ring,
      sides: curb.sides,
      segs: curb.segs,
      box: bounds(curb.ring),
    }
    if (curb.sides.includes('edge')) walks.push(face)
    else if (area(curb.ring) < ISLAND_AREA) islands.push(face)
    else {
      const lot = faceOutline(net, f, (k) => SECTION[k].half + SECTION[k].walk, false)
      blocks.push({ ...face, lot: lot.ring, lotSides: lot.sides, district: district(curb, net) })
    }
  }
  return { blocks, walks, islands }
}

/** The canal runs north-south down the middle of the column east of x = 0, out through both city edges. */
function canalRect(land: Rect, k: number): Rect {
  const cx = 50 * k
  return { x0: cx - CANAL_HALF, x1: cx + CANAL_HALF, z0: land.z0, z1: land.z1 }
}

/** Blocks with their lots built on, a few of them parks. */
function buildOn(plain: Plain[], size: number, r: () => number): Block[] {
  const parkable = plain.filter(
    (b) => !b.sides.includes('canal') && b.district !== 'beachfront' && area(b.lot) < 9000,
  )
  // Duplicate picks collapse, so this makes at most round(size / 350) parks.
  const parks = new Set(Array.from({ length: Math.round(size / 350) }, () => pick(r, parkable)))
  return plain.map((b) => {
    const park = parks.has(b)
    const lots = park ? { buildings: [], gardens: [], plazas: [], parking: [] } : buildingsFor(b, r)
    return { ...b, park, ...lots }
  })
}

/** The player's start: on the promenade beside the coast road, at z. */
function spawnBeside(coast: { x: number; z: number }[], z: number) {
  const near = coast.reduce((a, p) => (Math.abs(p.z - z) < Math.abs(a.z - z) ? p : a))
  return { x: near.x + SECTION.avenue.half + 3, z }
}

export function generateCity(seed = 7, size = 1000): CityLayout {
  const r = rng(seed)
  const half = size / 2
  const k = half / 500
  const beachX = half - 150 * k
  const land = { x0: -half - 14, x1: beachX + 16, z0: -half - 14, z1: half + 14 }
  const canal = canalRect(land, k)
  const net = buildNetwork(streetPlan(half, land, canal, beachX))
  const sorted = sortFaces(net)
  const blocks = buildOn(sorted.blocks, size, r)
  const coast = net.lines.find((l) => l.name === 'coast road')!.pts
  const junctions = junctionPlans(net)
  const { walks, islands } = sorted
  const plan = { blocks, walks, islands, land, net }
  const extra = { promenade: promenadeLawns(coast, land), medians: mediansOf(net, junctions) }
  const driveways = blocks.flatMap(drivewaysOf)
  return {
    seed,
    size,
    ...plan,
    ...extra,
    junctions,
    canal,
    bridges: canalBridges(net, canal),
    ...clearOfDriveways(greenery({ ...plan, ...extra }, r), driveways),
    driveways,
    spawn: spawnBeside(coast, 40 * k),
  }
}

/** Every lawn a step above the sidewalk: medians, parks, gardens, traffic islands, and the promenade's strips. */
export function lawnsOf(
  c: Pick<CityLayout, 'blocks' | 'islands' | 'promenade' | 'medians'>,
): Ring[] {
  return [
    ...c.medians.map((m) => insetRing(m.ring, 0.3)),
    ...c.blocks.flatMap((b) => (b.park ? [b.lot] : b.gardens)),
    ...c.islands.map((f) => insetRing(f.curb, 0.3)),
    ...c.promenade,
  ]
}
