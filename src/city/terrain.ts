import { CURB_H, ROAD_HALF, SEA_LEVEL, type CityLayout, type Rect } from './layout'

/** Ground under the paved city: below every slab and road, so it never shows through. */
export const UNDER_CITY = -0.6
export const CANAL_FLOOR = -4
/** Terrain grid spacing. Land edges sit on multiples of 2 m, so 4 m cells keep the sand edge clean. */
export const CELL = 4
/** How far the sand and seabed extend past the paved island on the north, south, and west. */
export const MARGIN = 160
// The beach side reaches further out, to where the sea is deep enough that its color
// no longer changes, so the seabed edge leaves no seam and swimmers get open water.
const SEA_MARGIN = 300

type Profile = [distance: number, height: number][]

// The east beach is wide and gentle like Miami Beach; the other shores drop off faster.
const BEACH: Profile = [
  [0, 0.05],
  [50, -0.7],
  [72, -1.6],
  [130, -3.6],
  [250, -8],
  [400, -12],
]
const SHORE: Profile = [
  [0, 0.05],
  [12, -0.8],
  [24, -2.4],
  [80, -6],
  [200, -10],
]

function sample(p: Profile, d: number): number {
  for (let i = 1; i < p.length; i++) {
    const [d1, h1] = p[i]
    if (d <= d1) {
      const [d0, h0] = p[i - 1]
      return h0 + ((h1 - h0) * (d - d0)) / (d1 - d0)
    }
  }
  return p[p.length - 1][1]
}

/** Ground height at (x, z). Points exactly on the land edge count as outside, so sand meets the slab. */
export function heightAt(c: Pick<CityLayout, 'land' | 'canal'>, x: number, z: number): number {
  const { land, canal } = c
  if (x > land.x0 && x < land.x1 && z > land.z0 && z < land.z1) {
    const inCanal = x > canal.x0 && x < canal.x1 && z > canal.z0 && z < canal.z1
    return inCanal ? CANAL_FLOOR : UNDER_CITY
  }
  const side = Math.max(land.z0 - z, z - land.z1, land.x0 - x, 0)
  const shore = sample(SHORE, side)
  return x > land.x1 ? Math.min(sample(BEACH, x - land.x1), shore) : shore
}

/** Water surface height at (x, z), or null on land. Sea and canal share sea level. */
export function waterSurfaceAt(c: Pick<CityLayout, 'land' | 'canal'>, x: number, z: number) {
  return heightAt(c, x, z) < SEA_LEVEL ? SEA_LEVEL : null
}

/** Terrain grid covering the island plus MARGIN, aligned so land edges fall on vertices. */
export function terrainGrid(c: Pick<CityLayout, 'land'>) {
  const x0 = c.land.x0 - MARGIN
  const z0 = c.land.z0 - MARGIN
  const nx = Math.round((c.land.x1 - c.land.x0 + MARGIN + SEA_MARGIN) / CELL)
  const nz = Math.round((c.land.z1 - c.land.z0 + 2 * MARGIN) / CELL)
  return { x0, z0, nx, nz, width: nx * CELL, depth: nz * CELL }
}

/** Park lawns sit a step above the sidewalk. */
export const PARK_TOP = CURB_H + 0.07

const within = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

/** Walkable surface height at (x, z): sand, road, park lawn, or sidewalk. */
export function surfaceAt(c: CityLayout, x: number, z: number): number {
  if (!within(c.land, x, z)) return heightAt(c, x, z)
  const lawn = (b: CityLayout['blocks'][number]) =>
    b.park ? within(b.lot, x, z) : b.gardens.some((g) => within(g, x, z))
  if (c.blocks.some(lawn)) return PARK_TOP
  const onRoad = c.roads.some((r) =>
    r.axis === 'x'
      ? Math.abs(z - r.at) < ROAD_HALF && x > r.from && x < r.to
      : Math.abs(x - r.at) < ROAD_HALF && z > r.from && z < r.to,
  )
  return onRoad ? 0 : CURB_H
}
