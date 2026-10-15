import { buildingsFor, type Building } from './lots'
import { greenery, type Spot } from './greenery'
import { rng } from './rng'

/*
 * Seeded city plan: pure data, no three.js. The renderer and physics both read
 * it, so what you see is exactly what you collide with. Everything is derived
 * from `size`, so a 2 km map is generateCity(seed, 2000).
 */

export const PITCH = 100
export const ROAD_HALF = 8
export const SIDEWALK = 4
export const EDGE_WALK = 6
export const BEACH_WALK = 8
export const CANAL_HALF = 14
export const SEA_LEVEL = -1.2
export const CURB_H = 0.15

export interface Rect {
  x0: number
  z0: number
  x1: number
  z1: number
}

export type District = 'downtown' | 'midtown' | 'deco' | 'beachfront'

export interface Block {
  rect: Rect
  lot: Rect
  district: District
  park: boolean
  /** Which side of the block faces the canal, if any. Lights and curbs skip it. */
  canalSide: 'west' | 'east' | null
  buildings: Building[]
  /** Empty lot cells planted as small lawns with palms. */
  gardens: Rect[]
}

/** A road centerline. `axis` is the direction it runs; `at` is its x (z-roads) or z (x-roads). */
export interface Road {
  axis: 'x' | 'z'
  at: number
  from: number
  to: number
}

export interface CityLayout {
  seed: number
  size: number
  xRoads: number[]
  zRoads: number[]
  roads: Road[]
  blocks: Block[]
  /** Paved strips with no buildings: the island edge walks and the beach promenade. */
  walks: Rect[]
  /** Outer edge of the paved island; terrain and sand start here. */
  land: Rect
  canal: Rect
  palms: Spot[]
  bushes: Spot[]
  lights: Spot[]
  spawn: { x: number; z: number }
}

export type { Building, Spot }

export const inset = (r: Rect, by: number): Rect => ({
  x0: r.x0 + by,
  z0: r.z0 + by,
  x1: r.x1 - by,
  z1: r.z1 - by,
})

function ticks(from: number, to: number, step: number): number[] {
  const out: number[] = []
  for (let v = from; v <= to + 1e-6; v += step) out.push(v)
  return out
}

function district(cx: number, isBeachfront: boolean, size: number): District {
  if (isBeachfront) return 'beachfront'
  if (cx > 0) return 'deco'
  return cx > -size * 0.25 ? 'midtown' : 'downtown'
}

/** One block per grid cell; the canal column splits into a west and an east half. */
function gridBlocks(xRoads: number[], zRoads: number[], canal: Rect, size: number) {
  const blocks: Omit<Block, 'buildings' | 'gardens' | 'park'>[] = []
  const last = xRoads.length - 2
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j < zRoads.length - 1; j++) {
      const rect = {
        x0: xRoads[i] + ROAD_HALF,
        z0: zRoads[j] + ROAD_HALF,
        x1: xRoads[i + 1] - ROAD_HALF,
        z1: zRoads[j + 1] - ROAD_HALF,
      }
      const d = district((rect.x0 + rect.x1) / 2, i === last, size)
      const split = rect.x0 < canal.x0 && rect.x1 > canal.x1
      const halves: [Rect, Block['canalSide']][] = split
        ? [
            [{ ...rect, x1: canal.x0 }, 'east'],
            [{ ...rect, x0: canal.x1 }, 'west'],
          ]
        : [[rect, null]]
      for (const [r, canalSide] of halves) {
        blocks.push({ rect: r, lot: inset(r, SIDEWALK), district: d, canalSide })
      }
    }
  }
  return blocks
}

function roadsFor(xRoads: number[], zRoads: number[]): Road[] {
  const xs = [xRoads[0] - ROAD_HALF, xRoads[xRoads.length - 1] + ROAD_HALF]
  const zs = [zRoads[0] - ROAD_HALF, zRoads[zRoads.length - 1] + ROAD_HALF]
  return [
    ...xRoads.map((at): Road => ({ axis: 'z', at, from: zs[0], to: zs[1] })),
    ...zRoads.map((at): Road => ({ axis: 'x', at, from: xs[0], to: xs[1] })),
  ]
}

function walksFor(land: Rect, xRoads: number[], zRoads: number[]): Rect[] {
  const west = xRoads[0] - ROAD_HALF
  const east = xRoads[xRoads.length - 1] + ROAD_HALF
  const north = zRoads[0] - ROAD_HALF
  const south = zRoads[zRoads.length - 1] + ROAD_HALF
  return [
    { ...land, x1: west },
    { ...land, x0: east },
    { x0: west, x1: east, z0: land.z0, z1: north },
    { x0: west, x1: east, z0: south, z1: land.z1 },
  ]
}

export function generateCity(seed = 7, size = 1000): CityLayout {
  const r = rng(seed)
  const half = size / 2
  const beachRoad = half - 150
  const xRoads = [...ticks(-half, beachRoad - PITCH / 2, PITCH), beachRoad]
  const zRoads = ticks(-half, half, PITCH)
  const land = {
    x0: xRoads[0] - ROAD_HALF - EDGE_WALK,
    x1: beachRoad + ROAD_HALF + BEACH_WALK,
    z0: zRoads[0] - ROAD_HALF - EDGE_WALK,
    z1: zRoads[zRoads.length - 1] + ROAD_HALF + EDGE_WALK,
  }
  const cx = PITCH / 2
  const canal = {
    x0: cx - CANAL_HALF,
    x1: cx + CANAL_HALF,
    z0: zRoads[0] + ROAD_HALF,
    z1: zRoads[zRoads.length - 1] - ROAD_HALF,
  }
  const plain = gridBlocks(xRoads, zRoads, canal, size)
  const parkable = plain.filter((b) => !b.canalSide && b.district !== 'beachfront')
  const parks = new Set(
    Array.from({ length: Math.round(size / 350) }, () => pickIndex(r, parkable)),
  )
  const blocks: Block[] = plain.map((b) => {
    const park = parks.has(parkable.indexOf(b))
    const lots = park ? { buildings: [], gardens: [] } : buildingsFor(b.lot, b.district, r)
    return { ...b, park, ...lots }
  })
  const walks = walksFor(land, xRoads, zRoads)
  const layout = { seed, size, xRoads, zRoads, roads: roadsFor(xRoads, zRoads), blocks, walks }
  return {
    ...layout,
    land,
    canal,
    ...greenery({ ...layout, land }, r),
    spawn: { x: beachRoad + ROAD_HALF + 3, z: 40 },
  }
}

function pickIndex<T>(r: () => number, items: T[]): number {
  return Math.floor(r() * items.length)
}
