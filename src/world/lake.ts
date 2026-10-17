import * as THREE from 'three'
import { LAKE, lakeShore } from '../land/lake'
import type { WorldCtx } from './blocks'

/*
 * The forest lake's still surface: a flat disc out to just past the shore at the lake's own
 * level, mirror-smooth but for drifting ripples, reflecting the sky's environment map.
 * Much cheaper than the sea's planar mirror, and the lake has no waves to need one.
 */

const RIPPLE_SPEED = 0.012

/** The surface as a fan from the middle to the shore, pushed a meter past it under the banks. */
function disc(): THREE.BufferGeometry {
  const ring = lakeShore(LAKE, 3)
  const pos = [LAKE.x, LAKE.level, LAKE.z]
  for (const p of ring) {
    const dx = p.x - LAKE.x
    const dz = p.z - LAKE.z
    const k = 1 + 1.2 / Math.hypot(dx, dz)
    pos.push(LAKE.x + dx * k, LAKE.level, LAKE.z + dz * k)
  }
  const idx: number[] = []
  for (let i = 1; i <= ring.length; i++) idx.push(0, (i % ring.length) + 1, i)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  // World x/z in meters as UVs, so the ripple texture keeps its scale.
  const uv = []
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 9, pos[i + 2] / 9)
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** Adds the lake's water; returns its per-frame update (ripples drift). */
export function buildLake(ctx: WorldCtx, normals: THREE.Texture): (dt: number) => void {
  const ripples = normals.clone()
  ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping
  const material = new THREE.MeshStandardMaterial({
    color: 0x1e4c46,
    roughness: 0.05,
    metalness: 0.15,
    normalMap: ripples,
    normalScale: new THREE.Vector2(0.18, 0.18),
    transparent: true,
    opacity: 0.9,
  })
  const mesh = new THREE.Mesh(disc(), material)
  mesh.receiveShadow = true
  ctx.scene.add(mesh)
  return (dt) => {
    ripples.offset.x += dt * RIPPLE_SPEED
    ripples.offset.y += dt * RIPPLE_SPEED * 0.6
  }
}
