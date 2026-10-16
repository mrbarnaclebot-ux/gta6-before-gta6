import { SEA_LEVEL } from '../city/layout'
import { FLOOR_H } from '../city/lots'
import { surfaceAt } from '../city/terrain'
import type { Land } from './plan'
import { closest, tangent } from './polyline'

/*
 * Where the two parody billboards stand: on the roofs of some low-rise buildings, facing the
 * street they are nearest, and on tall poles beside the highway, turned toward the traffic.
 * Pure data for world/billboards.ts.
 */

export interface Billboard {
  /** Foot of the structure: the roof, or the ground under the pole. */
  x: number
  y: number
  z: number
  /** Yaw: the picture (+z) faces this way. */
  r: number
  /** Sign atlas layer (8 or 9), and whether it stands on a pole by the highway. */
  layer: number
  pole: boolean
}

const EVERY = 260
/** Meters off the highway's edge. */
const SIDE = 10
const CLEAR = 6

/** One building in this many low-rise ones carries a billboard. */
const ROOF_SHARE = 9

function onRoofs(land: Land): Billboard[] {
  const out: Billboard[] = []
  for (const block of land.blocks) {
    if (block.district === 'downtown') continue
    for (const b of block.buildings) {
      if (b.style === 'glass' || b.floors > 7 || b.seed % ROOF_SHARE !== 0) continue
      const { lot } = block
      const gaps = [lot.x1 - b.x - b.w / 2, b.x - b.w / 2 - lot.x0, lot.z1 - b.z - b.d / 2]
      gaps.push(b.z - b.d / 2 - lot.z0)
      const side = gaps.indexOf(Math.min(...gaps))
      const r = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][side]
      if ((side < 2 ? b.d : b.w) < 11) continue
      const y = b.floors * FLOOR_H[b.style]
      out.push({ x: b.x, y, z: b.z, r, layer: 8 + (b.seed % 2), pole: false })
    }
  }
  return out
}

/** Clear of every road: no pole stands on a ramp or a street beside the highway. */
function offRoads(land: Land, p: { x: number; z: number }): boolean {
  return land.paths.every((q) => closest(q.pts, p).d > q.width / 2 + CLEAR)
}

function byHighway(land: Land): Billboard[] {
  const out: Billboard[] = []
  for (const road of land.paths.filter((p) => p.kind === 'highway')) {
    const step = Math.max(1, Math.round(EVERY / 4))
    for (let i = step; i < road.pts.length - step; i += step) {
      const t = tangent(road.pts, i)
      const side = out.length % 2 ? 1 : -1
      const by = side * (road.width / 2 + SIDE)
      const p = { x: road.pts[i].x - t.z * by, z: road.pts[i].z + t.x * by }
      const y = surfaceAt(land, p.x, p.z)
      if (y < SEA_LEVEL + 1 || Math.abs(y - road.pts[i].y) > 4 || !offRoads(land, p)) continue
      // Facing the oncoming traffic, turned a little toward the road.
      const r = Math.atan2(-t.x, -t.z) - side * 0.35
      out.push({ ...p, y, r, layer: 8 + (out.length % 2), pole: true })
    }
  }
  return out
}

export const billboardsFor = (land: Land): Billboard[] => [...onRoofs(land), ...byHighway(land)]
