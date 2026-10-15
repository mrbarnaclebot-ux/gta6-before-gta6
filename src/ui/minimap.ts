import type { P2 as P } from '../land/polyline'
import { carIcon, hospitalIcon, playerArrow, routeLine, waypointIcon } from './map-icons'
import type { Base } from './map-paint'

// CSS pixels; the canvas backing store is scaled by devicePixelRatio.
const W = 240
const H = 156
// The player sits below the middle, so more of the road ahead shows.
const CX = W / 2
const CY = H * 0.6
const RADIUS = 10
// Pixels per meter on foot and at speed: about 320 m and 480 m across.
const ZOOM_FOOT = 0.75
const ZOOM_CAR = 0.5
// How fast the map turns after the camera, per second: smooth, but never lagging far behind.
const TURN_RATE = 12

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
  /** Parked cars: ground position and facing. */
  cars: { x: number; z: number; heading: number }[]
  /** The GPS route after the player's position, ending at the waypoint; empty for none. */
  route: P[]
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** A rounded, rotating map in the corner: roads, water, parks, hospitals, cars, the route. */
export class Minimap {
  private readonly g: CanvasRenderingContext2D
  private readonly dpr = Math.min(devicePixelRatio || 1, 2)
  private zoom = ZOOM_FOOT
  private yaw = NaN
  /** What the last frame drew, so a still player costs no redraw. */
  private last = ''

  constructor(
    canvas: HTMLCanvasElement,
    private readonly base: Base,
    private readonly hospitals: { x: number; z: number }[],
  ) {
    canvas.width = W * this.dpr
    canvas.height = H * this.dpr
    this.g = canvas.getContext('2d')!
  }

  draw(m: MapMarks, dt: number): void {
    this.zoom += ((m.driving ? ZOOM_CAR : ZOOM_FOOT) - this.zoom) * Math.min(1, dt * 2)
    this.yaw = Number.isNaN(this.yaw)
      ? m.yaw
      : this.yaw + wrap(m.yaw - this.yaw) * Math.min(1, dt * TURN_RATE)
    const s = m.search?.blink ? m.search : null
    const key = [
      m.x,
      m.z,
      this.yaw,
      m.heading,
      this.zoom,
      s?.r,
      s?.x,
      m.route.length,
      m.route[m.route.length - 1]?.x,
    ].join()
    if (key === this.last) return
    this.last = key
    const g = this.g
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    g.save()
    g.beginPath()
    g.roundRect(0, 0, W, H, RADIUS)
    g.clip()
    this.ground(m, s)
    this.marks(m)
    g.restore()
    this.north()
  }

  /** Route, cars, hospitals, the waypoint, and the player, in screen pixels. */
  private marks(m: MapMarks): void {
    const g = this.g
    const at = (x: number, z: number) => this.toScreen(m, x, z)
    if (m.route.length) routeLine(g, [{ x: CX, y: CY }, ...m.route.map((p) => at(p.x, p.z))], 3)
    for (const c of m.cars) {
      const p = at(c.x, c.z)
      carIcon(g, p.x, p.y, Math.PI - c.heading + this.yaw)
    }
    for (const h of this.hospitals) {
      const p = at(h.x, h.z)
      hospitalIcon(g, p.x, p.y, 0.85)
    }
    const end = m.route[m.route.length - 1]
    if (end) {
      const p = this.pinned(at(end.x, end.z))
      waypointIcon(g, p.x, p.y)
    }
    playerArrow(g, CX, CY, Math.PI - (m.heading - this.yaw))
  }

  /** The base map and the search area, in world space turned by the camera yaw. */
  private ground(m: MapMarks, s: { x: number; z: number; r: number } | null): void {
    const g = this.g
    g.save()
    g.translate(CX, CY)
    g.rotate(this.yaw)
    g.scale(this.zoom, this.zoom)
    g.translate(-m.x, -m.z)
    g.drawImage(this.base.canvas, this.base.x0, this.base.z0)
    if (s) {
      g.beginPath()
      g.arc(s.x, s.z, s.r, 0, Math.PI * 2)
      g.fillStyle = 'rgba(230, 40, 60, 0.18)'
      g.fill()
    }
    g.restore()
  }

  private toScreen(m: MapMarks, x: number, z: number) {
    const dx = (x - m.x) * this.zoom
    const dz = (z - m.z) * this.zoom
    const c = Math.cos(this.yaw)
    const s = Math.sin(this.yaw)
    return { x: CX + dx * c - dz * s, y: CY + dx * s + dz * c }
  }

  /** A far waypoint sticks to the edge, so it still shows which way to go. The pin's tip is at p. */
  private pinned(p: { x: number; y: number }) {
    return { x: Math.min(W - 12, Math.max(12, p.x)), y: Math.min(H - 4, Math.max(28, p.y)) }
  }

  /** A dark disc with "N" on the rim where north (-z) lies after turning by the camera yaw. */
  private north(): void {
    const g = this.g
    const dx = Math.sin(this.yaw)
    const dy = -Math.cos(this.yaw)
    const t = Math.min((W / 2 - 11) / Math.abs(dx || 1e-6), (H / 2 - 11) / Math.abs(dy || 1e-6))
    const x = W / 2 + dx * t
    const y = H / 2 + dy * t
    g.beginPath()
    g.arc(x, y, 8.5, 0, Math.PI * 2)
    g.fillStyle = 'rgba(10, 8, 20, 0.85)'
    g.fill()
    g.font = '700 10px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#ffffff'
    g.fillText('N', x, y + 0.5)
  }
}
