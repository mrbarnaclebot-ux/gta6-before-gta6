import * as THREE from 'three'
import { CURB_H, inset, ROAD_HALF, type CityLayout, type Rect } from '../city/layout'
import { PARK_TOP, UNDER_CITY } from '../city/terrain'
import { addMerged, rectBox, rectCollider, type WorldCtx } from './blocks'
import { pbr } from './materials'
import { wornAsphalt, wornPaving } from '../render/road-wear'

const CURB_W = 0.3

export function roadRect(road: CityLayout['roads'][number]): Rect {
  return road.axis === 'x'
    ? { x0: road.from, x1: road.to, z0: road.at - ROAD_HALF, z1: road.at + ROAD_HALF }
    : { x0: road.at - ROAD_HALF, x1: road.at + ROAD_HALF, z0: road.from, z1: road.to }
}

/**
 * Flat road quad with UVs taken from world x/z, so crossing roads overlap with
 * identical texels at intersections instead of z-fighting.
 */
function roadQuad(r: Rect): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2)
  geo.translate((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2)
  const pos = geo.attributes.position
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i))
  return geo
}

/** A raised sidewalk: paver slab ringed by a lighter 0.3 m concrete curb. */
function slabParts(r: Rect) {
  const top = CURB_H
  const curbs = [
    { ...r, x1: r.x0 + CURB_W },
    { ...r, x0: r.x1 - CURB_W },
    { ...r, x0: r.x0 + CURB_W, x1: r.x1 - CURB_W, z1: r.z0 + CURB_W },
    { ...r, x0: r.x0 + CURB_W, x1: r.x1 - CURB_W, z0: r.z1 - CURB_W },
  ]
  return {
    paving: rectBox(inset(r, CURB_W), UNDER_CITY, top),
    curbs: curbs.map((c) => rectBox(c, UNDER_CITY, top)),
  }
}

export function buildGround(ctx: WorldCtx, c: CityLayout): void {
  const asphalt = wornAsphalt(pbr('asphalt_02', 0.25, { color: 0xb8b4ae }))
  const paving = wornPaving(pbr('concrete_pavement_02', 0.5, { color: 0xf6f0e6 }))
  const curb = pbr('white_stucco', 0.5, { color: 0xd9d6d0, roughness: 0.9 })
  const grass = pbr('aerial_grass_rock', 0.2, { color: 0xc0d098 })

  const roads = c.roads.map(roadRect)
  addMerged(ctx, roads.map(roadQuad), asphalt, { cast: false, receive: true })
  for (const r of roads) rectCollider(ctx, r, UNDER_CITY, 0)

  const slabs = [...c.blocks.map((b) => b.rect), ...c.walks]
  const parts = slabs.map(slabParts)
  addMerged(
    ctx,
    parts.map((p) => p.paving),
    paving,
  )
  addMerged(
    ctx,
    parts.flatMap((p) => p.curbs),
    curb,
  )
  for (const s of slabs) rectCollider(ctx, s, UNDER_CITY, CURB_H)

  const parks = c.blocks.flatMap((b) => (b.park ? [b.lot] : b.gardens))
  addMerged(
    ctx,
    parks.map((p) => rectBox(p, 0, PARK_TOP)),
    grass,
  )
  for (const p of parks) rectCollider(ctx, p, 0, PARK_TOP)
}
