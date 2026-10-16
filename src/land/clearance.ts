import { inset } from '../city/layout'
import { gridRect } from './grid'
import { LOOKOUT_R } from './hillside'
import type { Land } from './plan'
import type { House } from './residential'

/*
 * Where plants may grow: a 2 m raster over the map marking roads, buildings, and the
 * city as blocked, and house yards as garden only.
 */

export const FREE = 0
export const YARD = 1
/** A front-yard strip by the street: no garden trees. */
export const VERGE_STRIP = 2
export const BLOCKED = 3
const CELL = 2

export interface Clearance {
  x0: number
  z0: number
  nx: number
  nz: number
  v: Uint8Array
}

/** What may grow at (x, z): FREE, YARD, VERGE_STRIP, or BLOCKED (also off the map). */
export function clearAt(c: Clearance, x: number, z: number): number {
  const i = Math.floor((x - c.x0) / CELL)
  const j = Math.floor((z - c.z0) / CELL)
  if (i < 0 || j < 0 || i >= c.nx || j >= c.nz) return BLOCKED
  return c.v[i * c.nz + j]
}

function mark(c: Clearance, i: number, j: number, value: number) {
  if (i < 0 || j < 0 || i >= c.nx || j >= c.nz) return
  const k = i * c.nz + j
  c.v[k] = Math.max(c.v[k], value)
}

/** Every cell whose center is within `r` of (x, z). */
function disc(c: Clearance, x: number, z: number, r: number, value: number) {
  const i0 = Math.floor((x - r - c.x0) / CELL)
  const j0 = Math.floor((z - r - c.z0) / CELL)
  for (let i = i0; i <= i0 + Math.ceil((2 * r) / CELL) + 1; i++) {
    for (let j = j0; j <= j0 + Math.ceil((2 * r) / CELL) + 1; j++) {
      const dx = c.x0 + (i + 0.5) * CELL - x
      const dz = c.z0 + (j + 0.5) * CELL - z
      if (dx * dx + dz * dz <= r * r) mark(c, i, j, value)
    }
  }
}

type Box = { x0: number; x1: number; z0: number; z1: number }

/** Cells inside a box given in the frame of something at (x, z) turned by `yaw`. */
function turnedBox(c: Clearance, at: { x: number; z: number; yaw: number }, b: Box, v: number) {
  const r = Math.hypot(Math.max(-b.x0, b.x1), Math.max(-b.z0, b.z1))
  const cos = Math.cos(at.yaw)
  const sin = Math.sin(at.yaw)
  const i0 = Math.floor((at.x - r - c.x0) / CELL)
  const j0 = Math.floor((at.z - r - c.z0) / CELL)
  for (let i = i0; i <= i0 + Math.ceil((2 * r) / CELL) + 1; i++) {
    for (let j = j0; j <= j0 + Math.ceil((2 * r) / CELL) + 1; j++) {
      const dx = c.x0 + (i + 0.5) * CELL - at.x
      const dz = c.z0 + (j + 0.5) * CELL - at.z
      // World to local: the inverse of the houses' local-to-world turn.
      const lx = dx * cos - dz * sin
      const lz = dx * sin + dz * cos
      if (lx >= b.x0 && lx <= b.x1 && lz >= b.z0 && lz <= b.z1) mark(c, i, j, v)
    }
  }
}

/** A house's yards (garden), and its walls and driveway (blocked). */
function house(c: Clearance, h: House) {
  const curbZ = (h.curb.x - h.x) * Math.sin(h.yaw) + (h.curb.z - h.z) * Math.cos(h.yaw)
  const w = h.w / 2
  const d = h.d / 2
  turnedBox(c, h, { x0: -w - 3, x1: w + 3, z0: -d - 11, z1: curbZ - 1 }, YARD)
  // The verge by the curb stays open: hedges and street palms stand there, not garden trees.
  turnedBox(c, h, { x0: -w - 3, x1: w + 3, z0: curbZ - 7, z1: curbZ - 1 }, VERGE_STRIP)
  turnedBox(c, h, { x0: -w - 1.2, x1: w + 1.2, z0: -d - 1.2, z1: d + 1.2 }, BLOCKED)
  const gx = h.garage * (w - 2.2)
  turnedBox(c, h, { x0: gx - 2.4, x1: gx + 2.4, z0: d, z1: curbZ + 1 }, BLOCKED)
}

/** Roads keep a verge clear, wider beside the highway; the trail is a footpath through the trees. */
const VERGE = { highway: 7, ramp: 5, trail: 1.2 } as Record<string, number>

/** `verge` overrides every road's clear margin (a tight mask for roadside rows). */
export function clearance(land: Land, verge?: number): Clearance {
  const g = gridRect(land.ground)
  const nx = Math.ceil((g.x1 - g.x0) / CELL)
  const nz = Math.ceil((g.z1 - g.z0) / CELL)
  const c: Clearance = { x0: g.x0, z0: g.z0, nx, nz, v: new Uint8Array(nx * nz) }
  const city = inset(land.land, -4)
  turnedBox(
    c,
    { x: 0, z: 0, yaw: 0 },
    { x0: city.x0, x1: city.x1, z0: city.z0, z1: city.z1 },
    BLOCKED,
  )
  for (const p of land.paths) {
    const r = p.width / 2 + (verge ?? VERGE[p.kind] ?? 3)
    const pts = p.closed ? [...p.pts, p.pts[0]] : p.pts
    for (let k = 0; k + 1 < pts.length; k++) {
      const n = Math.ceil(Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].z - pts[k].z) / 1.5)
      for (let t = 0; t <= n; t++) {
        const x = pts[k].x + ((pts[k + 1].x - pts[k].x) * t) / n
        const z = pts[k].z + ((pts[k + 1].z - pts[k].z) * t) / n
        disc(c, x, z, r, BLOCKED)
      }
    }
  }
  for (const h of land.houses) house(c, h)
  for (const v of land.villas) {
    turnedBox(
      c,
      v,
      { x0: -v.w / 2 - 4, x1: v.w / 2 + 4, z0: -v.d / 2 - 4, z1: v.d / 2 + 4 },
      BLOCKED,
    )
  }
  // The lookout is a lawn: grass, no trees or bushes in the view.
  disc(c, land.lookout.x, land.lookout.z, LOOKOUT_R + 3, VERGE_STRIP)
  return c
}
