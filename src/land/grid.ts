import type { Rect } from '../city/layout'

/** Terrain grid spacing in meters. The city's edges sit on whole cells, so slabs meet the ground cleanly. */
export const CELL = 4

/**
 * Heights on a regular grid of (nx + 1) x (nz + 1) vertices, column-major
 * (index ix * (nz + 1) + iz), which is the layout Rapier's heightfield expects.
 */
export interface HeightGrid {
  x0: number
  z0: number
  nx: number
  nz: number
  h: Float32Array
}

export const gridRect = (g: HeightGrid): Rect => ({
  x0: g.x0,
  z0: g.z0,
  x1: g.x0 + g.nx * CELL,
  z1: g.z0 + g.nz * CELL,
})

export const index = (g: HeightGrid, ix: number, iz: number) => ix * (g.nz + 1) + iz

/** An empty grid covering `r`, which must span whole cells from its x0/z0. */
export function emptyGrid(r: Rect): HeightGrid {
  const nx = Math.round((r.x1 - r.x0) / CELL)
  const nz = Math.round((r.z1 - r.z0) / CELL)
  return { x0: r.x0, z0: r.z0, nx, nz, h: new Float32Array((nx + 1) * (nz + 1)) }
}

/**
 * Height at (x, z) on the same two triangles per cell that the terrain mesh and Rapier's
 * heightfield draw (split along the (i+1, j)-(i, j+1) diagonal), so whatever stands on this
 * height stands on what is drawn and collided with. Clamped to the grid's edge.
 */
export function sampleGrid(g: HeightGrid, x: number, z: number): number {
  const fx = Math.min(g.nx - 1e-6, Math.max(0, (x - g.x0) / CELL))
  const fz = Math.min(g.nz - 1e-6, Math.max(0, (z - g.z0) / CELL))
  const ix = Math.floor(fx)
  const iz = Math.floor(fz)
  const tx = fx - ix
  const tz = fz - iz
  const n = g.nz + 1
  const h = g.h
  const b = h[(ix + 1) * n + iz]
  const c = h[ix * n + iz + 1]
  if (tx + tz <= 1) {
    const a = h[ix * n + iz]
    return a + (b - a) * tx + (c - a) * tz
  }
  const d = h[(ix + 1) * n + iz + 1]
  return d + (c - d) * (1 - tx) + (b - d) * (1 - tz)
}

/** Ground slope at (x, z) as rise over run, from neighbouring samples one cell apart. */
export function slopeAt(g: HeightGrid, x: number, z: number): number {
  const dx = sampleGrid(g, x + CELL, z) - sampleGrid(g, x - CELL, z)
  const dz = sampleGrid(g, x, z + CELL) - sampleGrid(g, x, z - CELL)
  return Math.hypot(dx, dz) / (2 * CELL)
}
