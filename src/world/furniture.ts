import * as THREE from 'three'
import { furnitureFor } from '../city/furniture'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import { addMerged, type WorldCtx } from './blocks'
import { groupByChunk } from './chunks'
import { FURNITURE_HALF, furniturePieces, type Mat } from './furniture-models'
import { DETAIL_LAYER } from './instancing'
import { signMaterial } from './sign-material'

/**
 * Metal, paint, wood, and glass share one material: at their size the difference in sheen
 * does not show, and every material is another draw call per chunk.
 */
function materials(): Record<Mat, THREE.Material> {
  const solid = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.3,
    roughness: 0.5,
  })
  return { metal: solid, paint: solid, wood: solid, glass: solid, sign: signMaterial() }
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
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
    for (const f of list) {
      turn.makeRotationY(f.r).setPosition(f.x, f.y, f.z)
      for (const p of furniturePieces(f.kind, f.v)) {
        const mat = mats[p.mat]
        const bucket = buckets.get(mat) ?? buckets.set(mat, []).get(mat)!
        bucket.push(p.geo.applyMatrix4(turn))
      }
    }
    // Detail layer: not in the sea mirror, and no shadow pass for things this small.
    for (const [mat, geos] of buckets) addMerged(ctx, geos, mat)?.layers.set(DETAIL_LAYER)
  }
  for (const f of items) {
    const [hx, hy, hz] = FURNITURE_HALF[f.kind]
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(f.x, f.y + hy, f.z)
    ctx.colliders.add(desc.setRotation({ x: 0, y: Math.sin(f.r / 2), z: 0, w: Math.cos(f.r / 2) }))
  }
}
