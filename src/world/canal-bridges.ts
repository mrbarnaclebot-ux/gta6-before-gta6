import * as THREE from 'three'
import { DECK, humpRise, humpSpan } from '../city/canal-bridge'
import { ROAD_HALF, type CityLayout } from '../city/layout'
import { UNDER_CITY } from '../city/terrain'
import { trimeshCollider } from '../scenery/bridges'
import { strip, sweep } from '../scenery/sweep'
import type { P3 } from '../land/polyline'
import type { WorldCtx } from './blocks'

/*
 * The humped road bridges where the city's streets cross the canal (shape in
 * city/canal-bridge.ts): the asphalt, a deck over the water, a solid body under the ramps,
 * and a parapet wall along each edge that also hides the drop to the sidewalk beside it.
 */

const PARAPET = { w: 0.45, h: 0.95 }
const ROAD = ROAD_HALF - PARAPET.w

type Pt = P3

/** One hump's centerline along the road at z = `at`, a point every meter. */
function line(c: CityLayout, at: number, x0: number, x1: number): Pt[] {
  const n = Math.round(x1 - x0)
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / n
    return { x, y: humpRise(c.canal, x), z: at }
  })
}

/**
 * A box strip along a line running +x: from z offset `a` to `b`, between per-point heights.
 * Faces: top, both sides, bottom; UVs in meters.
 */
function slab(pts: Pt[], a: number, b: number, bottom: (p: Pt) => number, top: (p: Pt) => number) {
  const pos: number[] = []
  const uv: number[] = []
  for (const p of pts) {
    const [y0, y1] = [bottom(p), top(p)]
    // Around the section: bottom a, top a, top b, bottom b.
    for (const [z, y, u] of [
      [a, y0, 0],
      [a, y1, y1 - y0],
      [b, y1, y1 - y0 + Math.abs(b - a)],
      [b, y0, 2 * (y1 - y0) + Math.abs(b - a)],
    ]) {
      pos.push(p.x, y, p.z + z)
      uv.push(p.x, u)
    }
  }
  const idx: number[] = []
  // Each face's winding depends on which side of the line `a` lies; flip so normals face out.
  const flip = a < b
  for (let i = 0; i + 1 < pts.length; i++) {
    for (let k = 0; k < 4; k++) {
      const [p, q] = [i * 4 + k, i * 4 + ((k + 1) % 4)]
      const [r, s] = [p + 4, q + 4]
      if (flip) idx.push(p, q, r, q, s, r)
      else idx.push(p, r, q, q, r, s)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  // Hard edges: unshared normals per face, as concrete has.
  const flat = geo.toNonIndexed()
  flat.computeVertexNormals()
  return { geo, flat }
}

/** Every hump: asphalt to merge with the streets, and stone for the decks, bodies, and parapets. */
export function canalBridges(ctx: WorldCtx, c: CityLayout) {
  const asphalt: THREE.BufferGeometry[] = []
  const stone: THREE.BufferGeometry[] = []
  const span = humpSpan(c.canal)
  const wet = (p: Pt) => p.x > c.canal.x0 && p.x < c.canal.x1
  for (const at of c.zRoads) {
    const pts = line(c, at, span.x0, span.x1)
    const road = sweep(pts, strip(ROAD, -ROAD, 0))
    trimeshCollider(ctx, road)
    asphalt.push(road)
    const foot = (p: Pt) => (wet(p) ? p.y - DECK : UNDER_CITY)
    for (const s of [-1, 1]) {
      const wall = slab(pts, s * ROAD, s * ROAD_HALF, foot, (p) => p.y + PARAPET.h)
      trimeshCollider(ctx, wall.geo)
      stone.push(wall.flat)
    }
    const under = slab(pts, -ROAD, ROAD, foot, (p) => p.y - 0.02)
    trimeshCollider(ctx, under.geo)
    stone.push(under.flat)
  }
  return { asphalt, stone }
}
