import * as THREE from 'three'
import { CURB_H, type Rect } from '../city/layout'
import { contains, rectRing, type Ring } from '../city/polygon'
import { POOL_WATER, poolsOf } from '../city/pools'
import { UNDER_CITY } from '../city/terrain'
import type { Land } from '../land/plan'
import { wornAsphalt } from '../render/road-wear'
import { RAPIER } from '../physics'
import { addMerged, rectBox, type WorldCtx } from './blocks'
import { pbr } from './materials'
import { flatRing, skirt } from './slabs'
import { PASTELS, umbrella } from '../scenery/beach'
import { rng } from '../city/rng'
import { FOUNTAIN, plazaFountain, plazaTrees } from '../city/greenery'

/*
 * What lies flat on the lots: paved plazas with round planters, surface parking lots,
 * hotel pools on the beachfront decks, and the concrete aprons of driveways across the
 * sidewalk. A handful of draw calls for the whole city.
 */

const PLANTER = { r: 1.5, h: 0.45 }

const OVER = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }

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
const waterMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: 0x13788a,
    roughness: 0.3,
    envMapIntensity: 0.5,
    ...OVER,
  })

/** Paved plazas, parking lots' asphalt, and pool water: one flat mesh each. */
function flats(ctx: WorldCtx, c: Land, pools: Rect[]): void {
  const tiles = pbr('concrete_pavement_02', 0.3, { color: 0xeadcc4, ...OVER })
  const plazas = c.blocks.flatMap((b) => b.plazas)
  const sunk = (p: Ring) => pools.filter((q) => contains(p, { x: q.x0, z: q.z0 })).map(rectRing)
  addMerged(
    ctx,
    plazas.map((p) => flatRing(p, CURB_H + 0.003, sunk(p))),
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
  addMerged(
    ctx,
    pools.map((p) => flatRing(rectRing(p), POOL_WATER)),
    waterMaterial(),
    FLAT,
  )
  // The basin's walls, in waterline tile, down to the hidden floor the water stands on.
  const tile = new THREE.MeshStandardMaterial({
    color: 0x4a9cba,
    roughness: 0.35,
    side: THREE.DoubleSide,
  })
  addMerged(
    ctx,
    pools.map((p) => skirt(rectRing(p), UNDER_CITY, CURB_H + 0.003)),
    tile,
    FLAT,
  )
}

/** A round basin with a column and a bowl, and the water in it. */
function fountain(p: { x: number; z: number }) {
  const r = FOUNTAIN.r
  const at = (g: THREE.BufferGeometry, y: number) => g.translate(p.x, CURB_H + y, p.z)
  return {
    stone: [
      at(new THREE.CylinderGeometry(r, r + 0.15, 0.6, 32, 1, true), 0.3),
      at(new THREE.TorusGeometry(r, 0.18, 6, 32).rotateX(Math.PI / 2), 0.6),
      at(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 12), 1.1),
      at(new THREE.CylinderGeometry(1.5, 0.5, 0.35, 20), 2.2),
    ],
    water: at(new THREE.CircleGeometry(r - 0.05, 32).rotateX(-Math.PI / 2), 0.45),
  }
}

/** Umbrellas over loungers down both long sides of each pool, facing the water. */
function poolside(ctx: WorldCtx, pools: Rect[]): void {
  const r = rng(77)
  const geos = pools.flatMap((p) => {
    const out: THREE.BufferGeometry[] = []
    for (let z = p.z0 + 2.5; z < p.z1 - 1.5; z += 5.5) {
      for (const [x, yaw] of [
        [p.x0 - 3.4, Math.PI / 2],
        [p.x1 + 3.4, -Math.PI / 2],
      ]) {
        const color = PASTELS[Math.floor(r() * PASTELS.length)]
        out.push(...umbrella(color, r).map((g) => g.rotateY(yaw).translate(x, CURB_H, z)))
      }
    }
    return out
  })
  addMerged(ctx, geos, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }))
}

/** The plazas' round planters (round the palms greenery.ts plants) and fountains, with colliders. */
function plazaStone(ctx: WorldCtx, c: Land) {
  // Not on the hotels' pool decks: the pool is their water, and they get umbrellas instead.
  const plazas = c.blocks.filter((b) => b.district !== 'beachfront').flatMap((b) => b.plazas)
  const planters = plazas.flatMap(plazaTrees)
  const fountains = plazas.map(plazaFountain).filter((f) => f !== null)
  for (const f of fountains) {
    const desc = RAPIER.ColliderDesc.cylinder(0.3, FOUNTAIN.r + 0.15)
    ctx.colliders.add(desc.setTranslation(f.x, CURB_H + 0.3, f.z))
  }
  for (const p of planters) {
    const desc = RAPIER.ColliderDesc.cylinder(PLANTER.h / 2, PLANTER.r)
    ctx.colliders.add(desc.setTranslation(p.x, CURB_H + PLANTER.h / 2, p.z))
  }
  const pot = (p: { x: number; z: number }) =>
    new THREE.CylinderGeometry(PLANTER.r, PLANTER.r + 0.1, PLANTER.h, 16).translate(
      p.x,
      CURB_H + PLANTER.h / 2,
      p.z,
    )
  const parts = fountains.map(fountain)
  return {
    stone: [...planters.map(pot), ...parts.flatMap((f) => f.stone)],
    water: parts.map((f) => f.water),
  }
}

/** Plazas, parking lots, pools, planters, and driveway aprons for every block. */
export function buildLots(ctx: WorldCtx, c: Land, stone: THREE.Material): void {
  const pools = poolsOf(c)
  flats(ctx, c, pools)
  poolside(ctx, pools)
  const aprons = c.driveways.map((d) => flatRing(apron(d), CURB_H + 0.002))
  const plaza = plazaStone(ctx, c)
  addMerged(ctx, [...pools.flatMap(coping), ...aprons, ...plaza.stone], stone)
  addMerged(ctx, plaza.water, waterMaterial(), FLAT)
}
