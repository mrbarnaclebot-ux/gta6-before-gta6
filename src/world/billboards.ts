import type RAPIER_NS from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { billboardsFor, type Billboard } from '../land/billboards'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import { addMerged, metricBox, tinted, type WorldCtx } from './blocks'
import { signMaterial, signQuad } from './sign-material'

const W = 10
const H = W / 1.79
const POLE = 9
const LEGS = 2.2
const STEEL = 0x3a3f43

/** The steel behind a picture: frame, catwalk, and legs or a pole, base at y = 0, picture at +z. */
function frame(b: Billboard): THREE.BufferGeometry[] {
  const lift = b.pole ? POLE : LEGS
  const parts: THREE.BufferGeometry[] = [
    metricBox(W + 0.4, H + 0.4, 0.3).translate(0, lift + H / 2, -0.2),
    metricBox(W, 0.08, 1.1).translate(0, lift - 0.1, 0.45),
  ]
  if (b.pole)
    parts.push(new THREE.CylinderGeometry(0.35, 0.45, POLE, 10).translate(0, POLE / 2, -0.4))
  else
    for (const x of [-W / 3, W / 3])
      parts.push(metricBox(0.25, LEGS, 0.25).translate(x, LEGS / 2, -0.3))
  return parts.map((g) => tinted(g, STEEL))
}

/**
 * Fixed colliders matching the steel in `frame`: the picture with its frame, the catwalk, and
 * the legs or the pole, turned with the board. They stream in with the other small colliders.
 */
export function billboardColliders(b: Billboard): RAPIER_NS.ColliderDesc[] {
  const lift = b.pole ? POLE : LEGS
  const [c, s] = [Math.cos(b.r), Math.sin(b.r)]
  const yaw = { x: 0, y: Math.sin(b.r / 2), z: 0, w: Math.cos(b.r / 2) }
  // A local offset turned by the board's yaw, as makeRotationY turns the meshes.
  const at = (d: RAPIER_NS.ColliderDesc, x: number, y: number, z: number) =>
    d.setTranslation(b.x + x * c + z * s, b.y + y, b.z - x * s + z * c).setRotation(yaw)
  const box = (x: number, y: number, z: number) => RAPIER.ColliderDesc.cuboid(x, y, z)
  const out = [
    at(box((W + 0.4) / 2, (H + 0.4) / 2, 0.15), 0, lift + H / 2, -0.2),
    at(box(W / 2, 0.04, 0.55), 0, lift - 0.1, 0.45),
  ]
  if (b.pole) out.push(at(RAPIER.ColliderDesc.cylinder(POLE / 2, 0.45), 0, POLE / 2, -0.4))
  else for (const x of [-W / 3, W / 3]) out.push(at(box(0.125, LEGS / 2, 0.125), x, LEGS / 2, -0.3))
  return out
}

/** Billboards on roofs and by the highway, two meshes for all of them, with colliders. */
export function buildBillboards(ctx: WorldCtx, land: Land): void {
  const boards = billboardsFor(land)
  const steel: THREE.BufferGeometry[] = []
  const pictures: THREE.BufferGeometry[] = []
  const m = new THREE.Matrix4()
  for (const b of boards) {
    m.makeRotationY(b.r).setPosition(b.x, b.y, b.z)
    steel.push(...frame(b).map((g) => g.applyMatrix4(m)))
    const lift = b.pole ? POLE : LEGS
    pictures.push(signQuad(W, H, b.layer).translate(0, lift, -0.04).applyMatrix4(m))
    for (const desc of billboardColliders(b)) ctx.colliders.add(desc)
  }
  const metal = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.5,
    roughness: 0.55,
  })
  addMerged(ctx, steel, metal)
  addMerged(ctx, pictures, signMaterial(), { cast: false, receive: true })
}
