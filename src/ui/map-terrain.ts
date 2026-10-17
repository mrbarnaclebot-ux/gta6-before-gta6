import { SEA_LEVEL } from '../city/layout'
import { forestAt } from '../land/districts'
import { CELL, index } from '../land/grid'
import type { Land } from '../land/plan'
import { sandAt, seaward } from '../land/coast'
import { LAKE, lakeSurfaceAt } from '../land/lake'

type RGB = [number, number, number]

const SEA: RGB = [43, 111, 142]
const SHALLOWS: RGB = [70, 160, 178]
const SAND: RGB = [216, 196, 151]
const GRASS: RGB = [104, 138, 82]
const FOREST: RGB = [62, 98, 62]
const ROCK: RGB = [140, 132, 118]
const DIRT: RGB = [150, 122, 88]
// Light from the north-west, as on most printed maps.
const LIGHT = [-0.55, 0.62, -0.55]
// A faint contour every this many meters of height.
const CONTOUR = 20

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Ground color before shading: sea by depth, sand, grass, forest, rock on slopes, dirt. The
 * waterline and the sand's edge blend over about a pixel, so the scaled-up map draws them smooth.
 */
function groundColor(land: Land, k: number, x: number, z: number, h: number, slope: number): RGB {
  const water = mix(SHALLOWS, SEA, clamp01((SEA_LEVEL - h) / 6))
  const wet = clamp01((SEA_LEVEL - h) / 0.5 + 0.5)
  if (lakeSurfaceAt(LAKE, x, z) !== null) return mix(SHALLOWS, SEA, 0.35)
  const { coast } = land.frame
  let c = mix(GRASS, FOREST, forestAt(x, z))
  c = mix(c, DIRT, land.dirt[k] / 255)
  c = mix(c, ROCK, clamp01((slope - 0.35) * 2.5))
  const sand = clamp01((seaward(coast, x, z) + 6) / 4) * clamp01((sandAt(coast, x, z) - 0.3) * 4)
  return mix(mix(c, SAND, sand), water, wet)
}

/**
 * The terrain at one pixel per grid cell (4 m): colored by ground cover, hill-shaded,
 * with faint contours. The caller scales it up under the roads and buildings.
 */
export function paintTerrain(land: Land): HTMLCanvasElement {
  const g = land.ground
  const canvas = document.createElement('canvas')
  canvas.width = g.nx + 1
  canvas.height = g.nz + 1
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(canvas.width, canvas.height)
  const h = (i: number, j: number) =>
    g.h[index(g, Math.min(g.nx, Math.max(0, i)), Math.min(g.nz, Math.max(0, j)))]
  for (let i = 0; i <= g.nx; i++) {
    for (let j = 0; j <= g.nz; j++) {
      const k = index(g, i, j)
      const dx = (h(i + 1, j) - h(i - 1, j)) / (2 * CELL)
      const dz = (h(i, j + 1) - h(i, j - 1)) / (2 * CELL)
      const len = Math.hypot(dx, 1, dz)
      const light = (-dx * LIGHT[0] + LIGHT[1] - dz * LIGHT[2]) / len
      const wet = clamp01((SEA_LEVEL - g.h[k]) / 0.5 + 0.5)
      const shade = 0.62 + 0.5 * light + (0.38 - 0.5 * light) * wet
      const c = groundColor(land, k, g.x0 + i * CELL, g.z0 + j * CELL, g.h[k], Math.hypot(dx, dz))
      const line =
        g.h[k] > 2 && Math.floor(g.h[k] / CONTOUR) !== Math.floor(h(i + 1, j) / CONTOUR) ? 0.85 : 1
      const p = (j * canvas.width + i) * 4
      img.data[p] = c[0] * shade * line
      img.data[p + 1] = c[1] * shade * line
      img.data[p + 2] = c[2] * shade * line
      img.data[p + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}
