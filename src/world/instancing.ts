import * as THREE from 'three'
import type { Spot } from '../city/layout'
import type { WorldCtx } from './blocks'
import { CHUNK, groupByChunk } from './chunks'

export interface Part {
  geometry: THREE.BufferGeometry
  material: THREE.Material
}

/**
 * Bakes every mesh of a loaded model into geometry normalized to 1 m tall,
 * centered on x/z with its base at y = 0, so a spot's size is its height in meters.
 */
export function modelParts(root: THREE.Object3D): Part[] {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  const scale = 1 / (box.max.y - box.min.y)
  const normalize = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z))
  const parts: Part[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const m = normalize.clone().multiply(mesh.matrixWorld)
    parts.push({
      geometry: mesh.geometry.clone().applyMatrix4(m),
      material: mesh.material as THREE.Material,
    })
  })
  return parts
}

/**
 * Small detail (ferns) lives on this layer. The main camera renders it; the water's
 * mirror camera only sees layer 0, so the reflection pass skips thousands of triangles.
 * The sun's shadow camera also only sees layer 0, so detail meshes never cast shadows.
 */
export const DETAIL_LAYER = 1

const tmp = new THREE.Object3D()

type Placement = { scale: (s: Spot) => number; ground: (s: Spot) => number }

/** One InstancedMesh per part for these spots. */
function instanced(parts: Part[], spots: Spot[], place: Placement) {
  return parts.map((part) => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, spots.length)
    spots.forEach((s, i) => {
      tmp.position.set(s.x, place.ground(s), s.z)
      tmp.rotation.set(0, s.r, 0)
      tmp.scale.setScalar(place.scale(s))
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    })
    mesh.computeBoundingSphere()
    mesh.castShadow = mesh.receiveShadow = true
    return mesh
  })
}

/**
 * Places a model at every spot: one InstancedMesh per part per `chunk`-sized square,
 * so whole chunks can be frustum-culled. Pass Infinity for one batch over the whole city.
 */
export function instanceParts(
  ctx: WorldCtx,
  parts: Part[],
  spots: Spot[],
  place: Placement,
  chunk = CHUNK,
): void {
  for (const group of groupByChunk(spots, chunk).values()) {
    ctx.scene.add(...instanced(parts, group, place))
  }
}
