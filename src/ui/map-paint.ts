import type { CityLayout, District, Rect } from '../city/layout'
import { roadRect } from '../world/ground'

// Sea past the island's edge that the map still shows, in meters.
const MARGIN = 220
// Dark edge drawn under each road so it reads against the blocks, in meters per side.
const CASING = 2

export const MAP_COLORS = {
  sea: '#2b6f8e',
  shallows: '#3f8fa6',
  sand: '#d8c497',
  land: '#3b3e46',
  building: '#565a65',
  park: '#4c7a45',
  casing: '#1f2127',
  road: '#a9aeb7',
}

export type Base = { canvas: HTMLCanvasElement; x0: number; z0: number }

function fillRect(g: CanvasRenderingContext2D, o: Base, r: Rect, color: string): void {
  g.fillStyle = color
  g.fillRect(r.x0 - o.x0, r.z0 - o.z0, r.x1 - r.x0, r.z1 - r.z0)
}

const grow = (r: Rect, by: number): Rect => ({
  x0: r.x0 - by,
  z0: r.z0 - by,
  x1: r.x1 + by,
  z1: r.z1 + by,
})

// ponytail: one pixel per meter, about 2440 px square (24 MB), shared by both maps;
// the full map blurs past 2x zoom. Paint tiles at 2 px/m if close zoom ever matters.
/** The whole city painted once, north up: water, beach, blocks, parks, buildings, and cased roads. */
export function paintBase(c: CityLayout): Base {
  const canvas = document.createElement('canvas')
  const o: Base = { canvas, x0: c.land.x0 - MARGIN, z0: c.land.z0 - MARGIN }
  canvas.width = Math.ceil(c.land.x1 - c.land.x0 + 2 * MARGIN)
  canvas.height = Math.ceil(c.land.z1 - c.land.z0 + 2 * MARGIN)
  const g = canvas.getContext('2d')!
  g.fillStyle = MAP_COLORS.sea
  g.fillRect(0, 0, canvas.width, canvas.height)
  const { land } = c
  // Where the seabed rises toward the shore: about 15 m off most shores, 60 m on the beach.
  const shore = { x0: land.x0 - 15, z0: land.z0 - 15, x1: land.x1 + 60, z1: land.z1 + 15 }
  fillRect(g, o, grow(shore, 30), MAP_COLORS.shallows)
  fillRect(g, o, shore, MAP_COLORS.sand)
  fillRect(g, o, land, MAP_COLORS.land)
  fillRect(g, o, c.canal, MAP_COLORS.shallows)
  for (const b of c.blocks) {
    if (b.park) fillRect(g, o, b.lot, MAP_COLORS.park)
    for (const garden of b.gardens) fillRect(g, o, garden, MAP_COLORS.park)
    for (const h of b.buildings) {
      const r = { x0: h.x - h.w / 2, z0: h.z - h.d / 2, x1: h.x + h.w / 2, z1: h.z + h.d / 2 }
      fillRect(g, o, r, MAP_COLORS.building)
    }
  }
  const roads = c.roads.map(roadRect)
  for (const r of roads) fillRect(g, o, grow(r, CASING), MAP_COLORS.casing)
  for (const r of roads) fillRect(g, o, r, MAP_COLORS.road)
  return o
}

const NAMES: Record<District, string> = {
  downtown: 'Downtown',
  midtown: 'Midtown',
  deco: 'Deco District',
  beachfront: 'Beachfront',
}

/** Each district's name at the middle of its blocks, for the full map. */
export function districtLabels(c: CityLayout): { name: string; x: number; z: number }[] {
  return (Object.keys(NAMES) as District[]).flatMap((d) => {
    const rects = c.blocks.filter((b) => b.district === d).map((b) => b.rect)
    if (!rects.length) return []
    const x = rects.reduce((s, r) => s + (r.x0 + r.x1) / 2, 0) / rects.length
    const z = rects.reduce((s, r) => s + (r.z0 + r.z1) / 2, 0) / rects.length
    return [{ name: NAMES[d], x, z }]
  })
}
