import { SEA_LEVEL, type District, type Rect } from '../city/layout'
import { beachHeight, coastX } from '../land/shape'
import { AREA_LABELS } from '../land/districts'
import { CELL, gridRect } from '../land/grid'
import type { Kind, Path } from '../land/path'
import type { Land } from '../land/plan'
import { paintTerrain } from './map-terrain'
import { roadRect } from '../world/ground'

// Dark edge drawn under each road so it reads against the blocks, in meters per side.
const CASING = 2

export const MAP_COLORS = {
  sea: '#2b6f8e',
  shallows: '#3f8fa6',
  land: '#3b3e46',
  ridge: '#5b7049',
  sand: '#d8c497',
  building: '#565a65',
  house: '#d9d2c4',
  park: '#4c7a45',
  casing: '#1f2127',
  road: '#a9aeb7',
  highway: '#f0b440',
  trail: '#8a6a45',
}

/** The painted map, where its top-left corner sits in the world, and where the sea starts beyond it. */
export type Base = { canvas: HTMLCanvasElement; x0: number; z0: number; coast: number }

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

/** The beach as a smooth band from the coast line to the waterline, over the 4 m terrain raster. */
function paintBeach(g: CanvasRenderingContext2D, o: Base, c: Land): void {
  const r = gridRect(c.ground)
  const zs: number[] = []
  for (let z = r.z0; z <= r.z1; z += 8) zs.push(z)
  const wet = (z: number) => {
    let d = 0
    while (d < 200 && beachHeight(d, z) > SEA_LEVEL) d += 1
    return d
  }
  g.beginPath()
  // From a little inland, covering the raster's 4 m steps at the coast line.
  zs.forEach((z) => g.lineTo(coastX(c.frame, z) - 6 - o.x0, z - o.z0))
  for (const z of [...zs].reverse()) g.lineTo(coastX(c.frame, z) + wet(z) - o.x0, z - o.z0)
  g.closePath()
  g.fillStyle = MAP_COLORS.sand
  g.fill()
}

/** The paved city: blocks, parks, buildings, and the grid roads over a dark casing. */
function paintCity(g: CanvasRenderingContext2D, o: Base, c: Land): void {
  fillRect(g, o, c.land, MAP_COLORS.land)
  fillRect(g, o, c.canal, MAP_COLORS.shallows)
  for (const b of c.blocks) {
    if (b.park) fillRect(g, o, b.lot, MAP_COLORS.park)
    for (const garden of b.gardens) fillRect(g, o, garden, MAP_COLORS.park)
    for (const h of b.buildings) {
      fillRect(
        g,
        o,
        { x0: h.x - h.w / 2, z0: h.z - h.d / 2, x1: h.x + h.w / 2, z1: h.z + h.d / 2 },
        MAP_COLORS.building,
      )
    }
  }
  const roads = c.roads.map(roadRect)
  for (const r of roads) fillRect(g, o, grow(r, CASING), MAP_COLORS.casing)
  for (const r of roads) fillRect(g, o, r, MAP_COLORS.road)
}

const ROAD_COLOR: Partial<Record<Kind, string>> = {
  highway: MAP_COLORS.highway,
  ramp: MAP_COLORS.highway,
  trail: MAP_COLORS.trail,
}

function stroke(g: CanvasRenderingContext2D, o: Base, p: Path, width: number, color: string): void {
  g.beginPath()
  p.pts.forEach((q, i) => (i ? g.lineTo(q.x - o.x0, q.z - o.z0) : g.moveTo(q.x - o.x0, q.z - o.z0)))
  if (p.closed) g.closePath()
  g.lineWidth = width
  g.strokeStyle = color
  g.stroke()
}

/** Roads outside the city: casings first, then surfaces, the highway last so it reads on top. */
function paintPaths(g: CanvasRenderingContext2D, o: Base, paths: Path[]): void {
  g.lineCap = g.lineJoin = 'round'
  const order = [...paths].sort(
    (a, b) => Number(a.kind === 'highway') - Number(b.kind === 'highway'),
  )
  for (const p of order)
    if (p.kind !== 'trail') stroke(g, o, p, p.width + 2 * CASING, MAP_COLORS.casing)
  for (const p of order) {
    g.setLineDash(p.kind === 'trail' ? [6, 5] : [])
    stroke(g, o, p, p.width, ROAD_COLOR[p.kind] ?? MAP_COLORS.road)
  }
  g.setLineDash([])
}

/** A turned rectangle (a house or villa footprint). */
function footprint(
  g: CanvasRenderingContext2D,
  o: Base,
  x: number,
  z: number,
  w: number,
  d: number,
  yaw: number,
) {
  g.save()
  g.translate(x - o.x0, z - o.z0)
  g.rotate(-yaw)
  g.fillRect(-w / 2, -d / 2, w, d)
  g.restore()
}

/** The whole map painted once, north up, one pixel per meter: terrain, city, roads, homes. */
export function paintBase(c: Land): Base {
  const r = gridRect(c.ground)
  const canvas = document.createElement('canvas')
  const o: Base = { canvas, x0: r.x0, z0: r.z0, coast: coastX(c.frame, r.z0) }
  canvas.width = r.x1 - r.x0
  canvas.height = r.z1 - r.z0
  const g = canvas.getContext('2d')!
  g.imageSmoothingEnabled = true
  g.drawImage(paintTerrain(c), -CELL / 2, -CELL / 2, canvas.width + CELL, canvas.height + CELL)
  paintBeach(g, o, c)
  paintCity(g, o, c)
  paintPaths(g, o, c.paths)
  g.fillStyle = MAP_COLORS.house
  for (const h of c.houses) footprint(g, o, h.x, h.z, h.w, h.d, h.yaw)
  for (const v of c.villas) footprint(g, o, v.x, v.z, v.w * 0.7, v.d * 0.6, v.yaw)
  return o
}

const NAMES: Record<District, string> = {
  downtown: 'Central',
  midtown: 'Midtown',
  deco: 'Deco District',
  beachfront: 'Beachfront',
}

/** District names for the full map: each city district at the middle of its blocks, then the outer areas. */
export function districtLabels(c: Land): { name: string; x: number; z: number }[] {
  const city = (Object.keys(NAMES) as District[]).flatMap((d) => {
    const rects = c.blocks.filter((b) => b.district === d).map((b) => b.rect)
    if (!rects.length) return []
    const x = rects.reduce((s, r) => s + (r.x0 + r.x1) / 2, 0) / rects.length
    // One block north of the middle, clear of the district's hospital.
    const z = rects.reduce((s, r) => s + (r.z0 + r.z1) / 2, 0) / rects.length - 100
    return [{ name: NAMES[d], x, z }]
  })
  return [...city, ...AREA_LABELS.map((a) => ({ name: a.name, x: a.at.x, z: a.at.z }))]
}
