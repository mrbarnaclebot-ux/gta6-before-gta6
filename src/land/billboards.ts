import { SEA_LEVEL } from '../city/layout'
import { FLOOR_H } from '../city/lots'
import { surfaceAt } from '../city/terrain'
import type { Land } from './plan'
import { closest, tangent } from './polyline'
import { runs } from '../city/curbs'

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

/** The axis direction (0 east, 1 west, 2 south, 3 north) from a point to the block's nearest street. */
function streetSide(block: Land['blocks'][number], p: { x: number; z: number }): number {
  let best = { d: Infinity, x: 0, z: 0 }
  for (const run of runs(block)) {
    if (run.kind !== 'street' && run.kind !== 'avenue') continue
    const c = closest(run.pts, p)
    if (c.d < best.d) best = { d: c.d, x: c.at.x - p.x, z: c.at.z - p.z }
  }
  if (Math.abs(best.x) > Math.abs(best.z)) return best.x > 0 ? 0 : 1
  return best.z > 0 ? 2 : 3
}

function onRoofs(land: Land): Billboard[] {
  const out: Billboard[] = []
  for (const block of land.blocks) {
    if (block.district === 'downtown') continue
    for (const b of block.buildings) {
      // Deco roofs only: glass and residential roofs keep a stair core or plant room at the center.
      if (b.style !== 'deco' || b.floors > 7 || b.seed % ROOF_SHARE !== 0) continue
      const side = streetSide(block, b)
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
