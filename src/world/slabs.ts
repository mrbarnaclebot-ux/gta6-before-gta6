import * as THREE from 'three'
import { bounds, centroid, clipRect, type Ring } from '../city/polygon'
import { RAPIER } from '../physics'
import type { WorldCtx } from './blocks'

/*
 * Geometry from plan rings: flat tops triangulated from an outline, vertical skirts round
 * it, and prism colliders cut into pieces small enough for Rapier's float precision (it lets
 * a capsule sink into cuboids hundreds of meters wide) and convex enough to collide true.
 */

/** A flat top over the ring at height y, facing up, UVs in meters. */
export function flatRing(ring: Ring, y: number): THREE.BufferGeometry {
  const contour = ring.map((p) => new THREE.Vector2(p.x, p.z))
  const tris = THREE.ShapeUtils.triangulateShape(contour, [])
  const pos = new Float32Array(ring.length * 3)
  const uv = new Float32Array(ring.length * 2)
  ring.forEach((p, i) => {
    pos.set([p.x, y, p.z], i * 3)
    uv.set([p.x, -p.z], i * 2)
  })
  const idx: number[] = []
  for (const [a, b, c] of tris) {
    // Wind so the face points up (+y): counterclockwise seen from above is clockwise in x, z.
    const cross =
      (ring[b].x - ring[a].x) * (ring[c].z - ring[a].z) -
      (ring[b].z - ring[a].z) * (ring[c].x - ring[a].x)
    idx.push(...(cross > 0 ? [a, c, b] : [a, b, c]))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute(
    'normal',
    new THREE.BufferAttribute(
      new Float32Array(ring.length * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  )
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(idx)
  return geo
}

/** A vertical skirt round the ring from y0 to y1, facing out. */
export function skirt(ring: Ring, y0: number, y1: number): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let u = 0
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length]
    const len = Math.hypot(q.x - p.x, q.z - p.z)
    const o = pos.length / 3
    pos.push(p.x, y0, p.z, q.x, y0, q.z, q.x, y1, q.z, p.x, y1, p.z)
    uv.push(u, y0, u + len, y0, u + len, y1, u, y1)
    // Inside on the left in x, z: this winding faces outward.
    idx.push(o, o + 2, o + 1, o, o + 3, o + 2)
    u += len
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** Collider pieces are cut to this grid. */
const PIECE = 40

/** The ring cut into pieces no bigger than PIECE meters a side. */
export function pieces(ring: Ring): Ring[] {
  const b = bounds(ring)
  if (b.x1 - b.x0 <= PIECE && b.z1 - b.z0 <= PIECE) return [ring]
  const out: Ring[] = []
  for (let x = b.x0; x < b.x1; x += PIECE) {
    for (let z = b.z0; z < b.z1; z += PIECE) {
      const part = clipRect(ring, { x0: x, x1: x + PIECE, z0: z, z1: z + PIECE })
      if (part.length >= 3) out.push(part)
    }
  }
  return out
}

/** Static colliders for a prism over the ring from y0 to y1, one convex hull per piece. */
export function prismCollider(ctx: WorldCtx, ring: Ring, y0: number, y1: number): void {
  for (const part of pieces(ring)) {
    const c = centroid(part)
    const pts = new Float32Array(part.length * 6)
    part.forEach((p, i) => {
      pts.set([p.x - c.x, y0, p.z - c.z, p.x - c.x, y1, p.z - c.z], i * 6)
    })
    const desc = RAPIER.ColliderDesc.convexHull(pts)
    if (desc) ctx.physics.createCollider(desc.setTranslation(c.x, 0, c.z))
  }
}
