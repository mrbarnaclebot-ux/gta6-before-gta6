import * as THREE from 'three'
import { CURB_H, lawnsOf, type Rect } from '../city/layout'
import { PARK_TOP, UNDER_CITY } from '../city/terrain'
import { insetRing, type Ring } from '../city/polygon'
import type { Driveway } from '../city/parking-lots'
import type { SideKind } from '../city/faces'
import type { Land } from '../land/plan'
import { addMerged, rectCollider, type WorldCtx } from './blocks'
import { pbr } from './materials'
import { wornAsphalt, wornPaving } from '../render/road-wear'
import { canalBridges } from './canal-bridges'
import { curbGeometry, CURB_W } from './curb-mesh'
import { flatRing, prismCollider, skirt } from './slabs'
import { buildLots } from './lots'

/*
 * The city's ground: one asphalt surface over the whole paved city (the canal aside), and on
 * it every raised face (blocks, walks, traffic islands, medians) as paving ringed by a curb,
 * with lawns a step higher. Plazas, parking lots, pools, and driveways are in lots.ts.
 */

/** Flat quad over a rect at y = 0, UVs from world x/z. */
function roadQuad(r: Rect): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0, 8, 8).rotateX(-Math.PI / 2)
  geo.translate((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2)
  const pos = geo.attributes.position
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i))
  return geo
}

interface Raised {
  ring: Ring
  sides?: SideKind[]
  drives: Driveway[]
}

/** Every raised face, with the driveways cut into its curb. */
function raised(c: Land): Raised[] {
  const near = (ring: Ring) => (d: Driveway) =>
    ring.some((p) => Math.hypot(p.x - d.x, p.z - d.z) < 60)
  return [
    ...c.blocks.map((b) => ({
      ring: b.curb,
      sides: b.sides,
      drives: c.driveways.filter(near(b.curb)),
    })),
    ...[...c.walks, ...c.islands].map((f) => ({ ring: f.curb, sides: f.sides, drives: [] })),
    ...c.medians.map((m) => ({ ring: m.ring, drives: [] })),
  ]
}

/** The streets: the paved city less the canal, which its humped bridges cross. Returns the bridges' stone. */
function streets(ctx: WorldCtx, c: Land): THREE.BufferGeometry[] {
  const asphalt = wornAsphalt(pbr('asphalt_02', 0.25, { color: 0xb8b4ae }))
  const halves = [
    { ...c.land, x1: c.canal.x0 },
    { ...c.land, x0: c.canal.x1 },
  ]
  const humps = canalBridges(ctx, c)
  addMerged(ctx, [...halves.map(roadQuad), ...humps.asphalt], asphalt, {
    cast: false,
    receive: true,
  })
  for (const r of halves) rectCollider(ctx, r, UNDER_CITY, 0)
  return humps.stone
}

/** Lawns a step above the paving, with their colliders. */
function lawns(ctx: WorldCtx, c: Land): void {
  const grass = pbr('aerial_grass_rock', 0.2, { color: 0xb4cc8c })
  const list = lawnsOf(c)
  addMerged(
    ctx,
    list.flatMap((l) => [flatRing(l, PARK_TOP), skirt(l, CURB_H - 0.01, PARK_TOP)]),
    grass,
  )
  for (const l of list) prismCollider(ctx, l, CURB_H, PARK_TOP)
}

export function buildGround(ctx: WorldCtx, c: Land): void {
  const paving = wornPaving(pbr('concrete_pavement_02', 0.5, { color: 0xf6f0e6 }))
  const curb = pbr('white_stucco', 0.5, { color: 0xc4bfb6, roughness: 0.9 })
  const bridgeStone = streets(ctx, c)
  const faces = raised(c)
  addMerged(
    ctx,
    faces.map((f) => flatRing(insetRing(f.ring, CURB_W), CURB_H)),
    paving,
  )
  addMerged(
    ctx,
    faces.flatMap((f) => curbGeometry(f.ring, f.sides, f.drives)),
    curb,
  )
  addMerged(ctx, bridgeStone, curb)
  buildLots(ctx, c, curb)
  for (const f of faces) prismCollider(ctx, f.ring, UNDER_CITY, CURB_H)
  lawns(ctx, c)
}
