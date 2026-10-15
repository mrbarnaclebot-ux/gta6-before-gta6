import * as THREE from 'three'
import { RAPIER, type PhysicsWorld } from '../physics'

export interface WorldCtx {
  scene: THREE.Scene
  physics: PhysicsWorld
}

/**
 * Box whose UVs are in meters, so one texture repeat value looks the same on a
 * curb and on a 60 m tower instead of stretching with the box size.
 */
export function metricBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z with 4 vertices each.
  const spans: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  spans.forEach(([su, sv], face) => {
    for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  })
  return geo
}

/** A static, shadowed box with a matching fixed collider. `pos` is the box center. */
export function block(
  ctx: WorldCtx,
  size: [number, number, number],
  pos: [number, number, number],
  material: THREE.Material,
  rotation = new THREE.Euler(),
): THREE.Mesh {
  const mesh = new THREE.Mesh(metricBox(...size), material)
  mesh.position.set(...pos)
  mesh.rotation.copy(rotation)
  mesh.castShadow = mesh.receiveShadow = true
  ctx.scene.add(mesh)
  const q = mesh.quaternion
  const desc = RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)
    .setTranslation(...pos)
    .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
  ctx.physics.createCollider(desc)
  return mesh
}
