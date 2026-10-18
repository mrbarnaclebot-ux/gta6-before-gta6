import * as THREE from 'three'
import { rng, range, type Rand } from '../city/rng'
import { beachProps } from '../land/beach-props'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import { pbrMaterial, withPbr } from '../world/bake-parts'
import { addMerged, metricBox, tinted, type WorldCtx } from '../world/blocks'
import { groupByChunk } from '../world/chunks'
import { repaint, type PropKit } from '../world/prop-kit'

/*
 * Beach furniture along the whole coast: the Blender Miami lifeguard towers on stilts,
 * each cabin in its own pastel, and clusters of procedural striped umbrellas with loungers
 * near the water, merged per chunk with vertex colors: one material.
 */

export const PASTELS = [0xf29bb2, 0x5fc6c0, 0xf6d06b, 0xf2a35e, 0x9fc3f0, 0xc7a6e8]
const WHITE = 0xe2ded4

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

/** A striped umbrella over two loungers facing +z, non-indexed with vertex colors. */
export function umbrella(color: number, r: Rand): THREE.BufferGeometry[] {
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

/** Lifeguard towers (the cabin on its stilts collides; the ramp is open) and umbrellas the length of the beach. */
export function buildBeach(ctx: WorldCtx, land: Land, kit: PropKit): void {
  const r = rng(91)
  const tower = kit.get('lifeguard_tower')?.toNonIndexed()
  // A tower model that failed to load leaves the beach without towers, colliders too.
  const things = beachProps(land, r).filter((t) => tower || t.kind !== 'tower')
  const material = pbrMaterial()
  for (const group of groupByChunk(things).values()) {
    const geos = group.flatMap((t) => {
      const color = PASTELS[t.tint % PASTELS.length]
      const parts =
        t.kind === 'tower'
          ? [repaint(tower!, color)]
          : umbrella(color, r).map((g) => withPbr(g, 0.7, 0))
      return parts.map((g) => g.rotateY(t.yaw).translate(t.x, t.y, t.z))
    })
    addMerged(ctx, geos, material)
  }
  for (const t of things.filter((q) => q.kind === 'tower')) {
    const desc = RAPIER.ColliderDesc.cuboid(1.6, 2.3, 1.6).setTranslation(t.x, t.y + 2.3, t.z)
    ctx.colliders.add(desc)
  }
}
