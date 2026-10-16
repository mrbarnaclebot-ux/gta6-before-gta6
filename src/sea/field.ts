import type { Rect } from '../city/layout'
import { OPEN_SEA, type SeaSample } from './waves'

/*
 * The sea field: per 2 m texel, water depth, signed distance to the shore, and how
 * big the waves get there. Baked once from the terrain height; the water shader reads
 * it as a texture and swimming reads the same numbers here, so they agree.
 */

export const FIELD_CELL = 2
// Waves in the walled canal are a ripple of the open sea's.
const CANAL_CALM = 0.15

export interface SeaField {
  x0: number
  z0: number
  w: number
  h: number
  /** Meters of water at rest, negative on land. */
  depth: Float32Array
  shore: Float32Array
  scale: Float32Array
}

/** Two-pass chamfer distance (1, sqrt 2) in cells from every cell to the nearest `target` cell. */
function chamfer(target: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h).map((_, i) => (target[i] ? 0 : 1e9))
  const D = Math.SQRT2
  const relax = (i: number, x: number, y: number, dx: number, dy: number, cost: number) => {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return
    const v = d[ny * w + nx] + cost
    if (v < d[i]) d[i] = v
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      relax(i, x, y, -1, 0, 1)
      relax(i, x, y, 0, -1, 1)
      relax(i, x, y, -1, -1, D)
      relax(i, x, y, 1, -1, D)
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      relax(i, x, y, 1, 0, 1)
      relax(i, x, y, 0, 1, 1)
      relax(i, x, y, 1, 1, D)
      relax(i, x, y, -1, 1, D)
    }
  }
  return d
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Waves shrink in the shallows and the canal, but never to nothing, so the waterline still laps. */
export const waveScale = (depth: number, calm: number) =>
  calm * (0.2 + 0.8 * smoothstep(0, 3, depth))

/** Bakes the field over `r` from the ground height; `canal` is the walled, calm water. */
export function bakeSeaField(
  height: (x: number, z: number) => number,
  seaLevel: number,
  r: Rect,
  canal: Rect,
): SeaField {
  const w = Math.ceil((r.x1 - r.x0) / FIELD_CELL) + 1
  const h = Math.ceil((r.z1 - r.z0) / FIELD_CELL) + 1
  const depth = new Float32Array(w * h)
  const wet = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      depth[k] = seaLevel - height(r.x0 + i * FIELD_CELL, r.z0 + j * FIELD_CELL)
      wet[k] = depth[k] > 0 ? 1 : 0
    }
  }
  const toLand = chamfer(
    wet.map((v) => 1 - v),
    w,
    h,
  )
  const toWater = chamfer(wet, w, h)
  const half = FIELD_CELL / 2
  const shore = new Float32Array(w * h)
  const scale = new Float32Array(w * h)
  for (let k = 0; k < w * h; k++) {
    shore[k] = wet[k] ? toLand[k] * FIELD_CELL - half : half - toWater[k] * FIELD_CELL
    const x = r.x0 + (k % w) * FIELD_CELL
    const z = r.z0 + Math.floor(k / w) * FIELD_CELL
    const inCanal = x > canal.x0 && x < canal.x1 && z > canal.z0 && z < canal.z1
    scale[k] = waveScale(depth[k], inCanal ? CANAL_CALM : 1)
  }
  return { x0: r.x0, z0: r.z0, w, h, depth, shore, scale }
}

/** Bilinear read of one channel at (x, z), the way the GPU filters the texture. Null outside. */
export function sampleField(f: SeaField, a: Float32Array, x: number, z: number): number | null {
  const fx = (x - f.x0) / FIELD_CELL
  const fz = (z - f.z0) / FIELD_CELL
  if (fx < 0 || fz < 0 || fx > f.w - 1 || fz > f.h - 1) return null
  const i = Math.min(Math.floor(fx), f.w - 2)
  const j = Math.min(Math.floor(fz), f.h - 2)
  const tx = fx - i
  const tz = fz - j
  const k = j * f.w + i
  const top = a[k] + (a[k + 1] - a[k]) * tx
  const bottom = a[k + f.w] + (a[k + f.w + 1] - a[k + f.w]) * tx
  return top + (bottom - top) * tz
}

/** Wave scale and shore distance at (x, z); past the field it is open sea. */
export function seaAt(
  f: SeaField,
  x: number,
  z: number,
  out: SeaSample = { scale: 1, shore: 0 },
): SeaSample {
  const scale = sampleField(f, f.scale, x, z)
  if (scale === null) return OPEN_SEA
  out.scale = scale
  out.shore = sampleField(f, f.shore, x, z) ?? OPEN_SEA.shore
  return out
}
