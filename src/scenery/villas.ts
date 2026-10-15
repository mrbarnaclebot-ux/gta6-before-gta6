import * as THREE from 'three'
import { heightAt } from '../city/terrain'
import type { Villa } from '../land/hillside'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import { addMerged, metricBox, tinted, type WorldCtx } from '../world/blocks'
import { pbr } from '../world/materials'

/*
 * Modern hillside villas: two white boxes, the upper one cantilevered, glass across the
 * back where the view is, a pool on the terrace, and a stone retaining wall where the
 * terrace stands out from the slope. Local space: terrace floor at y = 0, front (+z)
 * facing the road uphill, the view down at -z.
 */

type Box = { w: number; h: number; d: number; x: number; y: number; z: number }

const STONE = 0xcdb99a
const WHITE = 0xf5f3ee

function volumes(v: Villa): Box[] {
  const flip = v.seed % 2 ? 1 : -1
  return [
    { w: 18, h: 3.4, d: 11, x: 0, y: 0, z: 2.5 },
    { w: 14, h: 3.2, d: 10, x: flip * 2.5, y: 3.4, z: 1 },
  ]
}

const toBox = (b: Box) => metricBox(b.w, b.h, b.d).translate(b.x, b.y + b.h / 2, b.z)

/** Glass across the back of each floor, set just proud of the wall. */
const backGlass = (b: Box) =>
  metricBox(b.w - 1.2, b.h - 0.9, 0.06).translate(b.x, b.y + b.h / 2, b.z - b.d / 2 - 0.04)

/** The retaining wall along the terrace's downhill edge and sides, from the ground up to waist height. */
function terraceWall(land: Land, v: Villa): THREE.BufferGeometry[] {
  const cos = Math.cos(v.yaw)
  const sin = Math.sin(v.yaw)
  const lowest = [-1, -0.5, 0, 0.5, 1].reduce((lo, t) => {
    const lx = (t * v.w) / 2
    const lz = -v.d / 2 - 4
    return Math.min(lo, heightAt(land, v.x + lx * cos + lz * sin, v.z - lx * sin + lz * cos))
  }, v.y)
  const drop = Math.max(0.5, v.y - lowest + 0.6)
  const back = metricBox(v.w, drop + 1, 0.5).translate(0, (1 - drop) / 2, -v.d / 2)
  const sides = [-1, 1].map((s) =>
    metricBox(0.5, drop + 1, v.d * 0.6).translate((s * v.w) / 2, (1 - drop) / 2, -v.d * 0.2),
  )
  return [back, ...sides]
}

interface Parts {
  white: THREE.BufferGeometry[]
  stone: THREE.BufferGeometry[]
  glass: THREE.BufferGeometry[]
  pool: THREE.BufferGeometry[]
}

function villaParts(land: Land, v: Villa, p: Parts): void {
  const start = {
    white: p.white.length,
    stone: p.stone.length,
    glass: p.glass.length,
    pool: p.pool.length,
  }
  for (const b of volumes(v)) {
    p.white.push(tinted(toBox({ ...b, y: b.y - 0.6, h: b.h + 0.6 }), WHITE))
    p.white.push(
      tinted(metricBox(b.w + 1.2, 0.3, b.d + 1.2).translate(b.x, b.y + b.h + 0.15, b.z), WHITE),
    )
    p.glass.push(backGlass(b))
  }
  p.glass.push(
    metricBox(3, 2.4, 0.06).translate(-3, 1.3, 8.04),
    metricBox(5, 1.2, 0.06).translate(4, 2.0, 8.04),
  )
  p.stone.push(...terraceWall(land, v).map((g) => tinted(g, STONE)))
  p.stone.push(tinted(metricBox(v.w - 1, 0.3, v.d - 1).translate(0, -0.15, 0), 0xe7e1d4))
  p.stone.push(tinted(metricBox(9, 0.4, 4.6).translate(-4, 0.1, -7.5), 0xf0ece4))
  p.pool.push(new THREE.PlaneGeometry(8, 3.8).rotateX(-Math.PI / 2).translate(-4, 0.31, -7.5))
  const place = (list: THREE.BufferGeometry[], from: number) => {
    for (let i = from; i < list.length; i++) list[i].rotateY(v.yaw).translate(v.x, v.y, v.z)
  }
  place(p.white, start.white)
  place(p.stone, start.stone)
  place(p.glass, start.glass)
  place(p.pool, start.pool)
}

function collide(ctx: WorldCtx, v: Villa): void {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), v.yaw)
  const rot = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyQuaternion(q)
  for (const b of volumes(v)) {
    const at = rot(b.x, b.z)
    const desc = RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2)
      .setTranslation(v.x + at.x, v.y + b.y + b.h / 2, v.z + at.z)
      .setRotation(q)
    ctx.physics.createCollider(desc)
  }
  const back = rot(0, -v.d / 2)
  const wall = RAPIER.ColliderDesc.cuboid(v.w / 2, 0.5, 0.25)
    .setTranslation(v.x + back.x, v.y + 0.5, v.z + back.z)
    .setRotation(q)
  ctx.physics.createCollider(wall)
}

/** Every villa merged by material (they are few), with colliders for the house and the terrace wall. */
export function buildVillas(ctx: WorldCtx, land: Land): void {
  const p: Parts = { white: [], stone: [], glass: [], pool: [] }
  for (const v of land.villas) {
    villaParts(land, v, p)
    collide(ctx, v)
  }
  addMerged(ctx, p.white, pbr('white_stucco', 0.5, { vertexColors: true }))
  addMerged(ctx, p.stone, pbr('white_stucco', 0.35, { vertexColors: true, roughness: 0.95 }))
  addMerged(
    ctx,
    p.glass,
    new THREE.MeshStandardMaterial({ color: 0x22313b, roughness: 0.05, metalness: 0.75 }),
  )
  const water = new THREE.MeshStandardMaterial({
    color: 0x31b9cf,
    roughness: 0.04,
    metalness: 0.15,
  })
  addMerged(ctx, p.pool, water, { cast: false, receive: true })
}
