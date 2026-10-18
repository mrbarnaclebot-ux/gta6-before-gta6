import * as THREE from 'three'
import { furnitureFor } from '../city/furniture'
import { plazaFurniture } from '../city/plaza-furniture'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import { pbrMaterial, withPbr } from './bake-parts'
import { addMerged, type WorldCtx } from './blocks'
import { groupByChunk } from './chunks'
import { FURNITURE_HALF, furniturePieces, type Mat } from './furniture-models'
import { DETAIL_LAYER } from './instancing'
import type { PropKit } from './prop-kit'
import { signMaterial } from './sign-material'

/**
 * Metal, paint, wood, and glass share one material, each vertex carrying its own roughness
 * and metalness (the procedural pieces a middling sheen): every material is another draw
 * call per chunk.
 */
function materials(): Record<Mat, THREE.Material> {
  const solid = pbrMaterial()
  // The bus shelters' panes: clear glass, so the bench and the street show through.
  const clear = pbrMaterial({ transparent: true, opacity: 0.3, depthWrite: false })
  return { metal: solid, paint: solid, wood: solid, glass: solid, clear, sign: signMaterial() }
}

const turn = new THREE.Matrix4()

/**
 * Benches, bins, hydrants, meters, newspaper boxes, bus stops, and signs on the sidewalks,
 * and benches and kiosks in the plazas, merged per chunk and material (a handful of draw
 * calls), each with a small box collider.
 */
export function buildFurniture(ctx: WorldCtx, c: Land, kit: PropKit): void {
  const items = [...furnitureFor(c, [...c.palms, ...c.lights]), ...plazaFurniture(c)]
  const mats = materials()
  for (const list of groupByChunk(items).values()) {
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
    for (const f of list) {
      turn.makeRotationY(f.r).setPosition(f.x, f.y, f.z)
      for (const p of furniturePieces(f.kind, f.v, kit)) {
        const mat = mats[p.mat]
        const bucket = buckets.get(mat) ?? buckets.set(mat, []).get(mat)!
        if (!p.geo.attributes.pbr && p.mat !== 'sign') withPbr(p.geo, 0.5, 0.3)
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
