import * as THREE from 'three'
import { CURB_H, type Rect } from '../city/layout'
import { area, bounds, rectInside, rectRing, type Ring } from '../city/polygon'
import type { Land } from '../land/plan'
import { wornAsphalt } from '../render/road-wear'
import { RAPIER } from '../physics'
import { addMerged, rectBox, type WorldCtx } from './blocks'
import { pbr } from './materials'
import { flatRing } from './slabs'
import { plazaTrees } from '../city/greenery'

/*
 * What lies flat on the lots: paved plazas with round planters, surface parking lots,
 * hotel pools on the beachfront decks, and the concrete aprons of driveways across the
 * sidewalk. A handful of draw calls for the whole city.
 */

const PLANTER = { r: 1.5, h: 0.45 }
const POOL_EDGE = 2.5

const OVER = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }

/** A rect sunk in a plaza: the pool's water, if the plaza holds one. */
function poolIn(plaza: Ring): Rect | null {
  if (area(plaza) < 120) return null
  const b = bounds(plaza)
  const r = {
    x0: b.x0 + POOL_EDGE,
    x1: b.x1 - POOL_EDGE,
    z0: b.z0 + POOL_EDGE,
    z1: b.z1 - POOL_EDGE,
  }
  if (r.x1 - r.x0 < 6 || r.z1 - r.z0 < 4) return null
  // A long, narrow lap pool along the deck rather than one filling it.
  const w = Math.min(r.x1 - r.x0, 9)
  const pool = {
    ...r,
    x0: (r.x0 + r.x1 - w) / 2,
    x1: (r.x0 + r.x1 + w) / 2,
    z1: Math.min(r.z1, r.z0 + 22),
  }
  return rectInside(pool, plaza) ? pool : null
}

/** A driveway's apron across the sidewalk, as a ring. */
function apron(d: Land['driveways'][number]): Ring {
  const f = { x: Math.sin(d.yaw), z: Math.cos(d.yaw) }
  const r = { x: f.z, z: -f.x }
  const deep = 4.2
  return [
    { x: d.x - (r.x * d.w) / 2, z: d.z - (r.z * d.w) / 2 },
    { x: d.x + (r.x * d.w) / 2, z: d.z + (r.z * d.w) / 2 },
    { x: d.x + (r.x * d.w) / 2 + f.x * deep, z: d.z + (r.z * d.w) / 2 + f.z * deep },
    { x: d.x - (r.x * d.w) / 2 + f.x * deep, z: d.z - (r.z * d.w) / 2 + f.z * deep },
  ]
}

/** Coping round a pool: four low stone strips. */
function coping(p: Rect): THREE.BufferGeometry[] {
  const e = 0.45
  return [
    { ...p, x0: p.x0 - e, x1: p.x1 + e, z1: p.z0 },
    { ...p, x0: p.x0 - e, x1: p.x1 + e, z0: p.z1 },
    { ...p, x1: p.x0, z0: p.z0, z1: p.z1, x0: p.x0 - e },
    { ...p, x0: p.x1, z0: p.z0, z1: p.z1, x1: p.x1 + e },
  ].map((r) => rectBox(r, CURB_H, CURB_H + 0.09))
}

const FLAT = { cast: false, receive: true }

/** The hotels' pools, on the beachfront's pool decks. */
const poolsOf = (c: Land) =>
  c.blocks
    .filter((b) => b.district === 'beachfront')
    .flatMap((b) => b.plazas.map(poolIn))
    .filter((p): p is Rect => p !== null)

/** Paved plazas, parking lots' asphalt, and pool water: one flat mesh each. */
function flats(ctx: WorldCtx, c: Land, pools: Rect[]): void {
  const tiles = pbr('concrete_pavement_02', 0.3, { color: 0xeadcc4, ...OVER })
  const plazas = c.blocks.flatMap((b) => b.plazas)
  addMerged(
    ctx,
    plazas.map((p) => flatRing(p, CURB_H + 0.003)),
    tiles,
    FLAT,
  )
  const tarmac = wornAsphalt(pbr('asphalt_02', 0.25, { color: 0xaaa69f, ...OVER }))
  const lots = c.blocks.flatMap((b) => b.parking)
  addMerged(
    ctx,
    lots.map((p) => flatRing(p, CURB_H + 0.004)),
    tarmac,
    FLAT,
  )
  const water = new THREE.MeshStandardMaterial({ color: 0x1f8ea3, roughness: 0.12, ...OVER })
  addMerged(
    ctx,
    pools.map((p) => flatRing(rectRing(p), CURB_H + 0.05)),
    water,
    FLAT,
  )
}

/** Plazas, parking lots, pools, planters, and driveway aprons for every block. */
export function buildLots(ctx: WorldCtx, c: Land, stone: THREE.Material): void {
  const pools = poolsOf(c)
  flats(ctx, c, pools)
  // Round the palms greenery.ts plants in the plazas (not the hotels' pool decks).
  const planters = c.blocks
    .filter((b) => b.district !== 'beachfront')
    .flatMap((b) => b.plazas.flatMap(plazaTrees))
  const pot = (p: { x: number; z: number }) =>
    new THREE.CylinderGeometry(PLANTER.r, PLANTER.r + 0.1, PLANTER.h, 16).translate(
      p.x,
      CURB_H + PLANTER.h / 2,
      p.z,
    )
  const aprons = c.driveways.map((d) => flatRing(apron(d), CURB_H + 0.002))
  addMerged(ctx, [...pools.flatMap(coping), ...aprons, ...planters.map(pot)], stone)
  for (const p of planters) {
    const desc = RAPIER.ColliderDesc.cylinder(PLANTER.h / 2, PLANTER.r)
    ctx.colliders.add(desc.setTranslation(p.x, CURB_H + PLANTER.h / 2, p.z))
  }
}
