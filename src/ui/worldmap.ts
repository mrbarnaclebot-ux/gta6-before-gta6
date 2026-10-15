import type { CityLayout } from '../city/layout'
import type { P } from '../city/route'
import { carIcon, hospitalIcon, playerArrow, routeLine, waypointIcon } from './map-icons'
import { districtLabels, MAP_COLORS, type Base } from './map-paint'
import type { Nav } from './nav'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// A press that moves less than this many pixels is a click, not a drag.
const CLICK_SLOP = 5
// Clicking this close to the waypoint, in pixels, removes it.
const PICK = 16
const MAX_ZOOM = 3
// Pixels per meter below which district names would overlap.
const LABEL_ZOOM = 0.5

export interface MapPlayer {
  x: number
  z: number
  heading: number
  cars: { x: number; z: number; heading: number }[]
}

/** The full-screen map on M: drag to pan, wheel to zoom, click to set or clear the waypoint. */
export class WorldMap {
  open = false
  private readonly root = $('worldmap')
  private readonly canvas = $<HTMLCanvasElement>('worldmap-canvas')
  private readonly g = this.canvas.getContext('2d')!
  private readonly labels: ReturnType<typeof districtLabels>
  private readonly dpr = Math.min(devicePixelRatio || 1, 2)
  private view = { x: 0, z: 0, scale: 1 }
  private player: MapPlayer = { x: 0, z: 0, heading: 0, cars: [] }
  private drag: { x: number; y: number; moved: number } | null = null
  private dirty = true

  constructor(
    private readonly base: Base,
    layout: CityLayout,
    private readonly hospitals: P[],
    private readonly nav: Nav,
  ) {
    this.labels = districtLabels(layout)
    this.wire()
  }

  toggle(p: MapPlayer): void {
    if (this.open) this.close()
    else this.show(p)
  }

  /** Opens centered on the player, zoomed to show the neighbourhood around them. */
  show(p: MapPlayer): void {
    this.open = true
    this.player = p
    this.root.hidden = false
    this.resize()
    this.view = { x: p.x, z: p.z, scale: Math.min(this.fit() * 2.2, 1) }
    this.clampView()
    this.canvas.focus()
    document.exitPointerLock?.()
  }

  close(): void {
    this.open = false
    this.root.hidden = true
  }

  /** Redraws only after a change: the world holds still while the map is open. */
  draw(): void {
    if (!this.open || !this.dirty) return
    this.dirty = false
    const g = this.g
    const { width, height } = this.size()
    const v = this.view
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    g.fillStyle = MAP_COLORS.sea
    g.fillRect(0, 0, width, height)
    g.save()
    g.translate(width / 2, height / 2)
    g.scale(v.scale, v.scale)
    g.translate(-v.x, -v.z)
    g.drawImage(this.base.canvas, this.base.x0, this.base.z0)
    g.restore()
    this.marks()
  }

  private marks(): void {
    const g = this.g
    const at = (q: P) => this.toScreen(q)
    this.districts()
    const me = this.player
    if (this.nav.path.length) routeLine(g, [at(me), ...this.nav.path.map(at)], 4)
    for (const c of me.cars) {
      const p = at(c)
      carIcon(g, p.x, p.y, Math.PI - c.heading)
    }
    for (const h of this.hospitals) {
      const p = at(h)
      hospitalIcon(g, p.x, p.y, 1.15)
    }
    if (this.nav.target) {
      const p = at(this.nav.target)
      waypointIcon(g, p.x, p.y)
    }
    const p = at(me)
    playerArrow(g, p.x, p.y, Math.PI - me.heading, 1.3)
  }

  /** District names, once zoomed in far enough that neighbouring names cannot collide. */
  private districts(): void {
    if (this.view.scale < LABEL_ZOOM) return
    const g = this.g
    g.font = `400 ${Math.round(Math.max(16, 26 * Math.sqrt(this.view.scale)))}px Anton, Impact, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = 4
    g.strokeStyle = 'rgba(10, 8, 20, 0.6)'
    g.fillStyle = 'rgba(255, 255, 255, 0.85)'
    for (const d of this.labels) {
      // One block north of the middle, clear of the district's hospital.
      const p = this.toScreen({ x: d.x, z: d.z - 100 })
      g.strokeText(d.name.toUpperCase(), p.x, p.y)
      g.fillText(d.name.toUpperCase(), p.x, p.y)
    }
  }

  private toScreen(q: P) {
    const { width, height } = this.size()
    const v = this.view
    return { x: width / 2 + (q.x - v.x) * v.scale, y: height / 2 + (q.z - v.z) * v.scale }
  }

  private toWorld(x: number, y: number): P {
    const { width, height } = this.size()
    const v = this.view
    return { x: v.x + (x - width / 2) / v.scale, z: v.z + (y - height / 2) / v.scale }
  }

  private size() {
    return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }
  }

  /** Scale that fits the whole painted map on screen. */
  private fit(): number {
    const { width, height } = this.size()
    return Math.min(width / this.base.canvas.width, height / this.base.canvas.height)
  }

  private resize(): void {
    const { width, height } = this.size()
    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    this.dirty = true
  }

  /** Keeps the map's middle over the painted area, so it never pans off into blank space. */
  private clampView(): void {
    const v = this.view
    const b = this.base
    v.scale = Math.min(MAX_ZOOM, Math.max(this.fit() * 0.9, v.scale))
    v.x = Math.min(b.x0 + b.canvas.width, Math.max(b.x0, v.x))
    v.z = Math.min(b.z0 + b.canvas.height, Math.max(b.z0, v.z))
    this.dirty = true
  }

  private click(x: number, y: number): void {
    const t = this.nav.target
    const near = t && Math.hypot(this.toScreen(t).x - x, this.toScreen(t).y - y) < PICK
    this.nav.set(near ? null : this.toWorld(x, y))
    // Plan from where the player stands now, so the route shows at once.
    this.nav.update(this.player)
    this.dirty = true
  }

  private wire(): void {
    const c = this.canvas
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId)
      this.drag = { x: e.clientX, y: e.clientY, moved: 0 }
    })
    c.addEventListener('pointermove', (e) => {
      const d = this.drag
      if (!d) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      d.moved += Math.hypot(dx, dy)
      Object.assign(d, { x: e.clientX, y: e.clientY })
      this.view.x -= dx / this.view.scale
      this.view.z -= dy / this.view.scale
      this.clampView()
    })
    c.addEventListener('pointerup', (e) => {
      if (this.drag && this.drag.moved < CLICK_SLOP) this.click(e.offsetX, e.offsetY)
      this.drag = null
    })
    c.addEventListener('wheel', (e) => this.zoom(e), { passive: false })
    window.addEventListener('resize', () => this.open && this.resize())
  }

  /** Zooms about the cursor: the spot under it stays put. */
  private zoom(e: WheelEvent): void {
    e.preventDefault()
    const before = this.toWorld(e.offsetX, e.offsetY)
    this.view.scale *= Math.exp(-e.deltaY * 0.0015)
    this.clampView()
    const after = this.toWorld(e.offsetX, e.offsetY)
    this.view.x += before.x - after.x
    this.view.z += before.z - after.z
    this.clampView()
  }
}
