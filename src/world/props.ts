import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CURB_H, type CityLayout } from '../city/layout'
import { RAPIER } from '../physics'
import type { WorldCtx } from './blocks'
import { instanceParts, type Part } from './instancing'

const POLE_H = 8

/**
 * Modern cobra-head streetlight, about 150 triangles. The CC0 lamp post on hand is a
 * Victorian model at about 1,500 triangles; with 800 lights it cost more than
 * every building combined. Local +z points over the road.
 */
function streetlight(): Part[] {
  const metal = new THREE.MeshStandardMaterial({ color: 0x8e9294, metalness: 0.8, roughness: 0.4 })
  const lens = new THREE.MeshStandardMaterial({
    color: 0xf4f1e8,
    emissive: 0x2a2620,
    roughness: 0.2,
  })
  const body = mergeGeometries([
    new THREE.CylinderGeometry(0.16, 0.19, 0.5, 8).translate(0, 0.25, 0),
    new THREE.CylinderGeometry(0.07, 0.11, POLE_H, 8).translate(0, POLE_H / 2, 0),
    new THREE.BoxGeometry(0.08, 0.08, 2.2).rotateX(-0.08).translate(0, POLE_H - 0.1, 1.05),
    new THREE.BoxGeometry(0.36, 0.14, 0.75).translate(0, POLE_H - 0.02, 2.25),
  ])
  const glow = new THREE.PlaneGeometry(0.28, 0.6)
    .rotateX(Math.PI / 2)
    .translate(0, POLE_H - 0.1, 2.25)
  return [
    { geometry: body, material: metal },
    { geometry: glow, material: lens },
  ]
}

/** Streetlights along every curb, each with a thin pole collider. */
export function placeProps(ctx: WorldCtx, c: CityLayout): void {
  instanceParts(ctx, streetlight(), c.lights, { scale: () => 1, ground: () => CURB_H })
  for (const s of c.lights) {
    const pole = RAPIER.ColliderDesc.cylinder(POLE_H / 2, 0.15)
    ctx.physics.createCollider(pole.setTranslation(s.x, CURB_H + POLE_H / 2, s.z))
  }
}
