import * as THREE from 'three'
import { heightAt } from '../city/terrain'
import type { Villa } from '../land/hillside'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import { addMerged, metricBox, tinted, type WorldCtx } from '../world/blocks'
import { pbr } from '../world/materials'

/*
 * The hillside villas' terraces: a paved pad and a stone retaining wall where the terrace
 * stands out from the slope (the houses themselves, pools and all, are the Blender models,
 * placed with the rest in houses.ts). Local space:
 * terrace floor at y = 0, front (+z) facing the road uphill, the view down at -z.
 */

const STONE = 0xcdb99a

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

function villaParts(land: Land, v: Villa): THREE.BufferGeometry[] {
  // Top 4 cm above the pad the terrain is flattened to, so the two never z-fight.
  const pad = tinted(metricBox(v.w - 1, 0.3, v.d - 1).translate(0, -0.11, 0), 0xe7e1d4)
  const parts = [...terraceWall(land, v).map((g) => tinted(g, STONE)), pad]
  return parts.map((g) => g.rotateY(v.yaw).translate(v.x, v.y, v.z))
}

function collide(ctx: WorldCtx, v: Villa): void {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), v.yaw)
  const back = new THREE.Vector3(0, 0, -v.d / 2).applyQuaternion(q)
  const wall = RAPIER.ColliderDesc.cuboid(v.w / 2, 0.5, 0.25)
    .setTranslation(v.x + back.x, v.y + 0.5, v.z + back.z)
    .setRotation(q)
  ctx.physics.createCollider(wall)
}

/** Every villa terrace merged into one mesh (they are few), with a collider for the terrace wall. */
export function buildVillas(ctx: WorldCtx, land: Land): void {
  const stone = land.villas.flatMap((v) => villaParts(land, v))
  land.villas.forEach((v) => collide(ctx, v))
  addMerged(ctx, stone, pbr('white_stucco', 0.35, { vertexColors: true, roughness: 0.95 }))
}
