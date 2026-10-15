import * as THREE from 'three'
import { SEA_LEVEL, type CityLayout } from '../city/layout'
import { CELL, heightAt, terrainGrid, UNDER_CITY } from '../city/terrain'
import { RAPIER } from '../physics'
import type { WorldCtx } from './blocks'
import { pbr } from './materials'

// Above 1 on purpose: brightens and cools the tan texture toward pale Miami sand.
const DRY = new THREE.Color(1.3, 1.26, 1.18)
const WET = new THREE.Color(0.85, 0.8, 0.72)
const DEEP = new THREE.Color(0.32, 0.5, 0.48)

/** Bright dry sand, a darker wet band at the waterline, then a blue-green seabed. */
function sandColor(h: number, out: THREE.Color): THREE.Color {
  const depth = SEA_LEVEL - h
  if (depth < -0.4) return out.copy(DRY)
  if (depth < 0.3) return out.lerpColors(DRY, WET, (depth + 0.4) / 0.7)
  return out.lerpColors(WET, DEEP, Math.min(1, (depth - 0.3) / 6))
}

/** Drops triangles buried under the city slabs: over half the grid, never seen. */
function visibleTriangles(geo: THREE.BufferGeometry): number[] {
  const idx = geo.index!.array
  const pos = geo.attributes.position
  const keep: number[] = []
  for (let i = 0; i < idx.length; i += 3) {
    const tri = [idx[i], idx[i + 1], idx[i + 2]]
    if (tri.some((v) => pos.getY(v) !== UNDER_CITY)) keep.push(...tri)
  }
  return keep
}

/** Beach, shore, and seabed as one mesh plus a matching Rapier heightfield. */
export function buildSand(ctx: WorldCtx, c: CityLayout): void {
  const g = terrainGrid(c)
  const geo = new THREE.PlaneGeometry(g.width, g.depth, g.nx, g.nz).rotateX(-Math.PI / 2)
  geo.translate(g.x0 + g.width / 2, 0, g.z0 + g.depth / 2)
  const pos = geo.attributes.position
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  // Column-major heights (x columns, z rows), the layout Rapier's heightfield expects.
  const heights = new Float32Array((g.nx + 1) * (g.nz + 1))
  const color = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = heightAt(c, x, z)
    pos.setY(i, h)
    uv.setXY(i, x / 3, z / 3)
    sandColor(h, color).toArray(colors, i * 3)
    const ix = Math.round((x - g.x0) / CELL)
    const iz = Math.round((z - g.z0) / CELL)
    heights[ix * (g.nz + 1) + iz] = h
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(visibleTriangles(geo))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, pbr('coast_sand_01', 1, { vertexColors: true }))
  mesh.receiveShadow = true
  ctx.scene.add(mesh)
  const desc = RAPIER.ColliderDesc.heightfield(g.nz, g.nx, heights, {
    x: g.width,
    y: 1,
    z: g.depth,
  })
  ctx.physics.createCollider(desc.setTranslation(g.x0 + g.width / 2, 0, g.z0 + g.depth / 2))
}
