import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Rect } from '../city/layout'
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

/** Metric box spanning a rect in plan and [y0, y1] in height. */
export function rectBox(r: Rect, y0: number, y1: number): THREE.BufferGeometry {
  const geo = metricBox(r.x1 - r.x0, y1 - y0, r.z1 - r.z0)
  return geo.translate((r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2)
}

/** Adds a flat vertex color so differently tinted parts can share one merged mesh. */
export function tinted(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const c = new THREE.Color(color)
  const n = geo.attributes.position.count
  const data = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) c.toArray(data, i * 3)
  geo.setAttribute('color', new THREE.BufferAttribute(data, 3))
  return geo
}

/** Merges many geometries into one static mesh: one draw call instead of hundreds. */
export function addMerged(
  ctx: WorldCtx,
  geos: THREE.BufferGeometry[],
  material: THREE.Material,
  shadows = { cast: true, receive: true },
): THREE.Mesh | null {
  if (!geos.length) return null
  const mesh = new THREE.Mesh(mergeGeometries(geos), material)
  mesh.castShadow = shadows.cast
  mesh.receiveShadow = shadows.receive
  mesh.matrixAutoUpdate = false
  ctx.scene.add(mesh)
  geos.forEach((g) => g.dispose())
  return mesh
}

// Rapier's f32 contact math lets the character sink into cuboids hundreds of
// meters wide, so long slabs are split into pieces no longer than this.
const MAX_COLLIDER = 100

/** Static box collider over a rect and height range, split into pieces at most 100 m long. */
export function rectCollider(ctx: WorldCtx, r: Rect, y0: number, y1: number): void {
  const nx = Math.ceil((r.x1 - r.x0) / MAX_COLLIDER)
  const nz = Math.ceil((r.z1 - r.z0) / MAX_COLLIDER)
  const w = (r.x1 - r.x0) / nx
  const d = (r.z1 - r.z0) / nz
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const desc = RAPIER.ColliderDesc.cuboid(w / 2, (y1 - y0) / 2, d / 2).setTranslation(
        r.x0 + w * (i + 0.5),
        (y0 + y1) / 2,
        r.z0 + d * (j + 0.5),
      )
      ctx.physics.createCollider(desc)
    }
  }
}
