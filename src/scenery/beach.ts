import * as THREE from 'three'
import { heightAt } from '../city/terrain'
import { rng, range, type Rand } from '../city/rng'
import { gridRect } from '../land/grid'
import type { Land } from '../land/plan'
import { coastX } from '../land/shape'
import { RAPIER } from '../physics'
import { addMerged, metricBox, tinted, type WorldCtx } from '../world/blocks'
import { groupByChunk } from '../world/chunks'

/*
 * Beach furniture along the whole coast: Miami-style lifeguard towers on stilts in
 * pastel paint, and clusters of striped umbrellas with loungers near the water.
 * Simple procedural models merged per chunk with vertex colors: one material.
 */

const PASTELS = [0xf29bb2, 0x5fc6c0, 0xf6d06b, 0xf2a35e, 0x9fc3f0, 0xc7a6e8]
const WHITE = 0xf3f1ea
const TOWER_GAP = 160
const TOWER_D = 34

type Thing = { x: number; z: number; kind: 'tower' | 'umbrella'; tint: number; yaw: number }

function tower(color: number): THREE.BufferGeometry[] {
  const parts = [-1.3, 1.3].flatMap((x) =>
    [-1.3, 1.3].map((z) => metricBox(0.18, 2.5, 0.18).translate(x, 1.25, z)),
  )
  const out = parts.map((g) => tinted(g, WHITE))
  out.push(tinted(metricBox(3.6, 0.2, 3.6).translate(0, 2.5, 0.4), WHITE))
  out.push(tinted(metricBox(2.6, 2.2, 2.4).translate(0, 3.7, -0.2), color))
  out.push(tinted(metricBox(2.0, 0.8, 0.06).translate(0, 4.0, 1.0), 0x26343c))
  out.push(tinted(metricBox(3.2, 0.16, 3.2).rotateX(0.12).translate(0, 4.95, -0.2), WHITE))
  const ramp = Math.atan2(2.5, 5)
  out.push(
    tinted(metricBox(1.1, 0.1, Math.hypot(2.5, 5)).rotateX(ramp).translate(0, 1.25, 4.6), WHITE),
  )
  return out
}

function canopy(color: number): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(1.45, 0.45, 10, 1, true).toNonIndexed()
  const n = geo.attributes.position.count
  const col = new Float32Array(n * 3)
  const a = new THREE.Color(color)
  const b = new THREE.Color(0xf7f5ef)
  // Each segment is two triangles (six vertices): alternate the stripe color per segment.
  for (let v = 0; v < n; v++) (Math.floor(v / 6) % 2 ? a : b).toArray(col, v * 3)
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()
  return geo.translate(0, 2.35, 0)
}

function umbrella(color: number, r: Rand): THREE.BufferGeometry[] {
  const tilt = range(r, -0.12, 0.12)
  const pole = tinted(
    new THREE.CylinderGeometry(0.035, 0.035, 2.5, 6).translate(0, 1.15, 0).toNonIndexed(),
    WHITE,
  )
  const loungers = [-0.8, 0.8].flatMap((x) => [
    tinted(metricBox(0.68, 0.32, 1.9).translate(x, 0.16, 1.3).toNonIndexed(), WHITE),
    tinted(metricBox(0.66, 0.08, 0.8).rotateX(-0.9).translate(x, 0.55, 0.45).toNonIndexed(), color),
  ])
  return [pole, canopy(color).rotateZ(tilt), ...loungers]
}

/** Where everything goes: towers at a steady spacing, umbrella clusters between them. */
function layout(land: Land, r: Rand): Thing[] {
  const g = gridRect(land.ground)
  const out: Thing[] = []
  for (let z = g.z0 + 110; z < g.z1 - 60; z += TOWER_GAP) {
    out.push({
      x: coastX(land.frame, z) + TOWER_D,
      z,
      kind: 'tower',
      tint: out.length,
      yaw: Math.PI / 2,
    })
    for (let c = z + 30; c < z + TOWER_GAP - 30; c += range(r, 35, 60)) {
      const n = 2 + Math.floor(r() * 3)
      const d = range(r, 38, 50)
      for (let k = 0; k < n; k++) {
        const zz = c + k * 5.5
        out.push({
          x: coastX(land.frame, zz) + d + range(r, -1, 1),
          z: zz,
          kind: 'umbrella',
          tint: Math.floor(r() * 99),
          yaw: Math.PI / 2 + range(r, -0.3, 0.3),
        })
      }
    }
  }
  return out
}

/** Lifeguard towers and umbrellas the length of the beach. Towers collide; the rest is open. */
export function buildBeach(ctx: WorldCtx, land: Land): void {
  const r = rng(91)
  const things = layout(land, r)
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })
  for (const group of groupByChunk(things).values()) {
    const geos = group.flatMap((t) => {
      const color = PASTELS[t.tint % PASTELS.length]
      const parts =
        t.kind === 'tower' ? tower(color).map((g) => g.toNonIndexed()) : umbrella(color, r)
      const y = heightAt(land, t.x, t.z)
      return parts.map((g) => g.rotateY(t.yaw).translate(t.x, y, t.z))
    })
    addMerged(ctx, geos, material)
  }
  for (const t of things.filter((q) => q.kind === 'tower')) {
    const desc = RAPIER.ColliderDesc.cuboid(1.8, 2.4, 1.8).setTranslation(
      t.x,
      heightAt(land, t.x, t.z) + 2.4,
      t.z,
    )
    ctx.physics.createCollider(desc)
  }
}
