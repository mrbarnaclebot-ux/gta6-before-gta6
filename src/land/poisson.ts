import type { Rect } from '../city/layout'
import { rng } from '../city/rng'
import type { P2 } from './polyline'

const TILE = 160
const TRIES = 30

/** Points so far, bucketed in cells of r / sqrt 2 (one point each) on a tile that wraps. */
function bucket(size: number, r: number) {
  const n = Math.ceil(size / (r / Math.SQRT2))
  const cell = size / n
  const grid = new Int32Array(n * n).fill(-1)
  const pts: P2[] = []
  const wrapped = (d: number) => Math.min(d, size - d)
  const near = (p: P2) => {
    const ci = Math.floor(p.x / cell)
    const cj = Math.floor(p.z / cell)
    for (let i = ci - 2; i <= ci + 2; i++) {
      for (let j = cj - 2; j <= cj + 2; j++) {
        const k = grid[((i + n) % n) * n + ((j + n) % n)]
        if (k < 0) continue
        const dx = wrapped(Math.abs(pts[k].x - p.x))
        const dz = wrapped(Math.abs(pts[k].z - p.z))
        if (dx * dx + dz * dz < r * r) return true
      }
    }
    return false
  }
  const add = (p: P2) => {
    grid[(Math.floor(p.x / cell) % n) * n + (Math.floor(p.z / cell) % n)] = pts.length
    pts.push(p)
  }
  return { pts, near, add }
}

/**
 * Poisson-disk points in a square tile that wraps (distances measured across its edges),
 * by Bridson's method: no two points closer than `r`, and no gap wider than 2r.
 */
export function poissonTile(r: number, seed: number, size = TILE): P2[] {
  const rand = rng(seed)
  const b = bucket(size, r)
  const wrap = (v: number) => ((v % size) + size) % size
  b.add({ x: rand() * size, z: rand() * size })
  for (const active = [0]; active.length;) {
    const at = Math.floor(rand() * active.length)
    const from = b.pts[active[at]]
    let found = false
    for (let t = 0; t < TRIES && !found; t++) {
      const a = rand() * Math.PI * 2
      const d = r * (1 + rand())
      const p = { x: wrap(from.x + d * Math.cos(a)), z: wrap(from.z + d * Math.sin(a)) }
      if (b.near(p)) continue
      active.push(b.pts.length)
      b.add(p)
      found = true
    }
    if (!found) active.splice(at, 1)
  }
  return b.pts
}

/**
 * The tile repeated over `area`. ponytail: a repeating tile, not one pass over the whole map;
 * density masks thin it differently everywhere, so the repeat does not show. A full-map
 * Bridson pass costs about 40x more at load.
 */
export function poissonOver(area: Rect, r: number, seed: number): P2[] {
  const tile = poissonTile(r, seed)
  const out: P2[] = []
  for (let x0 = Math.floor(area.x0 / TILE) * TILE; x0 < area.x1; x0 += TILE) {
    for (let z0 = Math.floor(area.z0 / TILE) * TILE; z0 < area.z1; z0 += TILE) {
      for (const p of tile) {
        const x = x0 + p.x
        const z = z0 + p.z
        if (x >= area.x0 && x < area.x1 && z >= area.z0 && z < area.z1) out.push({ x, z })
      }
    }
  }
  return out
}
