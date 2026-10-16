import * as THREE from 'three'
import { furnitureFor } from '../city/furniture'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import { addMerged, type WorldCtx } from './blocks'
import { groupByChunk } from './chunks'
import { FURNITURE_HALF, furniturePieces, type Mat } from './furniture-models'
import { signMaterial } from './sign-material'

function materials(): Record<Mat, THREE.Material> {
  const lit = (p: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ vertexColors: true, ...p })
  return {
    metal: lit({ metalness: 0.6, roughness: 0.45 }),
    paint: lit({ metalness: 0.1, roughness: 0.5 }),
    wood: lit({ roughness: 0.75 }),
    glass: lit({ metalness: 0.2, roughness: 0.05 }),
    sign: signMaterial(),
  }
}

const turn = new THREE.Matrix4()

/**
 * Benches, bins, hydrants, meters, newspaper boxes, bus stops, and signs on the sidewalks,
 * merged per chunk and material (a handful of draw calls), each with a small box collider.
 */
export function buildFurniture(ctx: WorldCtx, c: Land): void {
  const items = furnitureFor(c, [...c.palms, ...c.lights])
  const mats = materials()
  for (const list of groupByChunk(items).values()) {
    const buckets = new Map<Mat, THREE.BufferGeometry[]>()
    for (const f of list) {
      turn.makeRotationY(f.r).setPosition(f.x, f.y, f.z)
      for (const p of furniturePieces(f.kind, f.v)) {
        const bucket = buckets.get(p.mat) ?? buckets.set(p.mat, []).get(p.mat)!
        bucket.push(p.geo.applyMatrix4(turn))
      }
    }
    for (const [mat, geos] of buckets) addMerged(ctx, geos, mats[mat])
  }
  for (const f of items) {
    const [hx, hy, hz] = FURNITURE_HALF[f.kind]
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(f.x, f.y + hy, f.z)
    ctx.colliders.add(desc.setRotation({ x: 0, y: Math.sin(f.r / 2), z: 0, w: Math.cos(f.r / 2) }))
  }
}
