import * as THREE from 'three'
import type { Grounded } from '../city/layout'
import { range, rng } from '../city/rng'
import { heightAt } from '../city/terrain'
import { sandyShore } from '../land/beach-props'
import { lie, upAt } from '../land/footing'
import type { Land } from '../land/plan'
import { TIDE_LINE } from '../land/shape'
import type { WorldCtx } from '../world/blocks'
import { instanceByDistance } from '../world/lod-instances'

/*
 * What the high tide leaves along every beach: clumps of dark seaweed and bleached
 * driftwood strewn along the wrack line, drawn near the camera only.
 */

const RANGE = 80

/** A low, lumpy mat of weed about a meter across. */
function weed(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, 1)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const wobble = 0.75 + 0.5 * Math.abs(Math.sin(pos.getX(i) * 9 + pos.getZ(i) * 7))
    pos.setXYZ(i, pos.getX(i) * wobble, Math.max(0, pos.getY(i)) * 0.18, pos.getZ(i) * 0.7 * wobble)
  }
  g.computeVertexNormals()
  return g
}

/** A weathered branch lying on the sand, a meter long at scale 1. */
function branch(): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(0.045, 0.07, 1, 6).rotateZ(Math.PI / 2).translate(0, 0.05, 0)
}

/** Spots along the wrack line of every sandy shore: mostly weed, now and then a branch. */
export function wrackSpots(land: Land): { weed: Grounded[]; wood: Grounded[] } {
  const r = rng(37)
  const ground = (x: number, z: number) => heightAt(land, x, z)
  const out = { weed: [] as Grounded[], wood: [] as Grounded[] }
  for (const s of sandyShore(land, 2.2)) {
    if (r() < 0.35) continue
    const d = TIDE_LINE + range(r, -1.6, 1.4)
    const side = range(r, -1, 1)
    const x = s.x + s.nx * d - s.nz * side
    const z = s.z + s.nz * d + s.nx * side
    const wood = r() < 0.22
    const scale = wood ? range(r, 0.8, 2.6) : range(r, 0.35, 0.9)
    const up = upAt(ground, x, z, 0.5)
    const y = lie(ground, x, z, 0.4, up) - 0.03
    const spot = { x, y, z, s: scale, r: r() * Math.PI * 2, up }
    ;(wood ? out.wood : out.weed).push(spot)
  }
  return out
}

/** The wrack: one instanced batch per kind, culled with distance. */
export function plantWrack(ctx: WorldCtx, land: Land) {
  const spots = wrackSpots(land)
  const place = { scale: (s: Grounded) => s.s, ranges: [RANGE], detail: true }
  const kelp = new THREE.MeshStandardMaterial({ color: 0x4a4626, roughness: 0.5 })
  const driftwood = new THREE.MeshStandardMaterial({ color: 0xb3a691, roughness: 0.95 })
  const updates = [
    instanceByDistance(ctx, [[{ geometry: weed(), material: kelp }], []], spots.weed, place),
    instanceByDistance(ctx, [[{ geometry: branch(), material: driftwood }], []], spots.wood, place),
  ]
  return (eye: THREE.Vector3, reach?: number) => updates.forEach((u) => u(eye, reach))
}
