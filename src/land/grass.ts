import type { Grounded } from '../city/layout'
import { SEA_LEVEL } from '../city/layout'
import { surfaceAt } from '../city/terrain'
import { BLOCKED, clearAt, type Clearance } from './clearance'
import { forestAt } from './districts'
import { stand } from './footing'
import { CELL, index, slopeAt } from './grid'
import { fbm } from './noise'
import type { Land } from './plan'
import { coastX } from './shape'

/*
 * Grass clumps around the camera: one candidate per cell of a fixed world grid, kept or
 * dropped by a hash of the cell, so walking about shows the same clumps in the same places.
 */

export const GRASS_CELL = 0.9
/** A clump's base radius per meter of height. */
export const GRASS_FOOT = 0.25
export const GRASS_SINK = 0.03

/** Four well-mixed numbers in [0, 1) from a cell. */
function hash4(i: number, j: number): [number, number, number, number] {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263)
  const out: number[] = []
  for (let k = 0; k < 4; k++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) + 0x9e3779b9
    out.push(((h ^ (h >>> 16)) >>> 0) / 4294967296)
  }
  return out as [number, number, number, number]
}

/** 0 to 1: how grassy the ground is, the inverse of the terrain's bare-dirt weight. */
export function grassiness(land: Land, clear: Clearance, x: number, z: number): number {
  if (clearAt(clear, x, z) === BLOCKED || x - coastX(land.frame, z) > -8) return 0
  const g = land.ground
  const i = Math.round((x - g.x0) / CELL)
  const j = Math.round((z - g.z0) / CELL)
  if (i < 0 || j < 0 || i > g.nx || j > g.nz) return 0
  const dirt = Math.max(land.dirt[index(g, i, j)] / 255, forestAt(x, z) * 0.6)
  const patches = 0.55 + 0.45 * fbm(x / 23, z / 23, 83, 2)
  return (1 - dirt) * patches * (slopeAt(g, x, z) > 0.8 ? 0 : 1)
}

/** Every grass clump within `radius` of (x, z), set on the ground; reuses `out`. */
export function grassAround(
  land: Land,
  clear: Clearance,
  x: number,
  z: number,
  radius: number,
  out: Grounded[] = [],
): Grounded[] {
  out.length = 0
  const surface = (a: number, b: number) => surfaceAt(land, a, b)
  const n = Math.ceil(radius / GRASS_CELL)
  const ci = Math.floor(x / GRASS_CELL)
  const cj = Math.floor(z / GRASS_CELL)
  for (let i = ci - n; i <= ci + n; i++) {
    for (let j = cj - n; j <= cj + n; j++) {
      const [a, b, c, d] = hash4(i, j)
      const px = (i + a) * GRASS_CELL
      const pz = (j + b) * GRASS_CELL
      if ((px - x) ** 2 + (pz - z) ** 2 > radius * radius) continue
      if (c > grassiness(land, clear, px, pz)) continue
      const s = 0.22 + 0.36 * d
      const y = stand(surface, px, pz, GRASS_FOOT * s, GRASS_SINK)
      if (y < SEA_LEVEL + 0.3) continue
      out.push({
        x: px,
        y,
        z: pz,
        s,
        r: (a + b) * Math.PI * 7,
        tint: c < 0.15 ? 0xc8b078 : 0xffffff,
      })
    }
  }
  return out
}
