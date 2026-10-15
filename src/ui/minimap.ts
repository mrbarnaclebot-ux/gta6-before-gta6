import type { CityLayout, Rect } from '../city/layout'
import { roadRect } from '../world/ground'

// CSS pixels; the canvas backing store is scaled by devicePixelRatio.
const SIZE = 168
// Pixels per meter on foot and at speed: about 110 m and 170 m of map around the player.
const ZOOM_FOOT = 0.75
const ZOOM_CAR = 0.5
const MARGIN = 220

const COLORS = {
  sea: '#1d5874',
  sand: '#c2b088',
  land: '#3b3f47',
  building: '#2e3138',
  park: '#46703f',
  road: '#8d939c',
}

type Bounds = { x0: number; z0: number }

/** The whole map painted once, one pixel per meter. */
function paintBase(c: CityLayout): { canvas: HTMLCanvasElement; origin: Bounds } {
  const origin = { x0: c.land.x0 - MARGIN, z0: c.land.z0 - MARGIN }
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(c.land.x1 - c.land.x0 + 2 * MARGIN)
  canvas.height = Math.ceil(c.land.z1 - c.land.z0 + 2 * MARGIN)
  const g = canvas.getContext('2d')!
  const fill = (r: Rect, color: string) => {
    g.fillStyle = color
    g.fillRect(r.x0 - origin.x0, r.z0 - origin.z0, r.x1 - r.x0, r.z1 - r.z0)
  }
  g.fillStyle = COLORS.sea
  g.fillRect(0, 0, canvas.width, canvas.height)
  // Where the seabed rises above sea level: about 15 m off most shores, 60 m on the beach.
  const { land } = c
  fill({ x0: land.x0 - 15, z0: land.z0 - 15, x1: land.x1 + 60, z1: land.z1 + 15 }, COLORS.sand)
  fill(land, COLORS.land)
  fill(c.canal, COLORS.sea)
  for (const b of c.blocks) {
    if (b.park) fill(b.lot, COLORS.park)
    for (const g2 of b.gardens) fill(g2, COLORS.park)
    for (const h of b.buildings) {
      fill(
        { x0: h.x - h.w / 2, z0: h.z - h.d / 2, x1: h.x + h.w / 2, z1: h.z + h.d / 2 },
        COLORS.building,
      )
    }
  }
  for (const r of c.roads) fill(roadRect(r), COLORS.road)
  return { canvas, origin }
}

/** What the minimap marks besides the map itself. */
export interface MapMarks {
  x: number
  z: number
  /** Camera yaw: the map turns so straight up is where the camera looks. */
  yaw: number
  /** The player's (or the car's) facing; yaw 0 faces +z. */
  heading: number
  driving: boolean
  /** The wanted search area, when there is one. */
  search: { x: number; z: number; r: number; blink: boolean } | null
}

/** A round, rotating map in the corner: roads, water, parks, hospitals, the player arrow. */
export class Minimap {
  private readonly g: CanvasRenderingContext2D
  private readonly base: ReturnType<typeof paintBase>
  private readonly dpr = Math.min(devicePixelRatio || 1, 2)
  private zoom = ZOOM_FOOT

  constructor(
    canvas: HTMLCanvasElement,
    layout: CityLayout,
    private readonly hospitals: { x: number; z: number }[],
  ) {
    canvas.width = canvas.height = SIZE * this.dpr
    this.g = canvas.getContext('2d')!
    this.base = paintBase(layout)
  }

  draw(m: MapMarks, dt: number): void {
    const g = this.g
    this.zoom += ((m.driving ? ZOOM_CAR : ZOOM_FOOT) - this.zoom) * Math.min(1, dt * 2)
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    g.clearRect(0, 0, SIZE, SIZE)
    g.save()
    g.beginPath()
    g.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
    g.clip()
    g.translate(SIZE / 2, SIZE / 2)
    g.rotate(m.yaw)
    g.scale(this.zoom, this.zoom)
    g.translate(-m.x, -m.z)
    g.drawImage(this.base.canvas, this.base.origin.x0, this.base.origin.z0)
    if (m.search && m.search.blink) this.searchArea(m.search)
    for (const h of this.hospitals) this.hospital(h.x, h.z, m.yaw)
    g.restore()
    this.arrow(Math.PI - (m.heading - m.yaw))
    this.north(m.yaw)
  }

  private searchArea(s: { x: number; z: number; r: number }): void {
    const g = this.g
    g.beginPath()
    g.arc(s.x, s.z, s.r, 0, Math.PI * 2)
    g.fillStyle = 'rgba(230, 40, 60, 0.22)'
    g.fill()
  }

  /** A red cross badge that stays upright and the same size at any zoom. */
  private hospital(x: number, z: number, yaw: number): void {
    const g = this.g
    g.save()
    g.translate(x, z)
    g.rotate(-yaw)
    g.scale(1 / this.zoom, 1 / this.zoom)
    g.fillStyle = '#e8eef2'
    g.fillRect(-6, -6, 12, 12)
    g.fillStyle = '#d6283c'
    g.fillRect(-1.6, -4.5, 3.2, 9)
    g.fillRect(-4.5, -1.6, 9, 3.2)
    g.restore()
  }

  private arrow(angle: number): void {
    const g = this.g
    g.save()
    g.translate(SIZE / 2, SIZE / 2)
    g.rotate(angle)
    g.beginPath()
    g.moveTo(0, -8)
    g.lineTo(6, 7)
    g.lineTo(0, 3.5)
    g.lineTo(-6, 7)
    g.closePath()
    g.fillStyle = '#ffffff'
    g.strokeStyle = 'rgba(0, 0, 0, 0.7)'
    g.lineWidth = 1.5
    g.fill()
    g.stroke()
    g.restore()
  }

  /** "N" on the rim where -z (north on the map plan) lies after turning by the camera yaw. */
  private north(yaw: number): void {
    const g = this.g
    const a = yaw - Math.PI / 2
    const r = SIZE / 2 - 10
    g.font = '700 11px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#ffffff'
    g.fillText('N', SIZE / 2 + Math.cos(a) * r, SIZE / 2 + Math.sin(a) * r)
  }
}
