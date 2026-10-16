import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * Procedural wheels: the generated car bodies come without any. A lathed tire with a
 * rounded shoulder and a five-spoke alloy, about 900 triangles, axle along x, rim face
 * toward +x. Two materials; all wheels of a car kind share one instanced
 * batch per material (see wheel-batch.ts).
 */

const SPOKES = 5

const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.86 })
const alloy = new THREE.MeshStandardMaterial({ color: 0xa4a7ad, metalness: 1, roughness: 0.26 })

/** Tire cross-section, lathed about y, then laid on its side. */
function tire(radius: number, width: number): THREE.BufferGeometry {
  const w = width / 2
  const rim = radius * 0.68
  const shoulder = Math.min(0.05, w * 0.4)
  const profile = [
    [rim, -w * 0.85],
    [radius - shoulder, -w],
    [radius - shoulder * 0.3, -w + shoulder * 0.3],
    [radius, -w + shoulder],
    [radius, w - shoulder],
    [radius - shoulder * 0.3, w - shoulder * 0.3],
    [radius - shoulder, w],
    [rim, w * 0.85],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  return new THREE.LatheGeometry(profile, 28).rotateZ(-Math.PI / 2)
}

/** Barrel, hub, and spokes, merged; the face sits just inside the tire's outer wall. */
function rimGeometry(radius: number, width: number): THREE.BufferGeometry {
  const r = radius * 0.68
  const face = width * 0.36
  const parts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(r, r, width * 0.8, 24, 1, true).rotateZ(Math.PI / 2),
    new THREE.CylinderGeometry(r * 0.22, r * 0.26, 0.05, 12)
      .rotateZ(Math.PI / 2)
      .translate(face, 0, 0),
    new THREE.TorusGeometry(r * 0.96, 0.012, 4, 24).rotateY(Math.PI / 2).translate(face, 0, 0),
  ]
  // Twin spokes, a lug nut between each pair, and the brake disc seen through them.
  for (let i = 0; i < SPOKES; i++) {
    const a = (i / SPOKES) * Math.PI * 2
    for (const side of [-0.13, 0.13]) {
      const spoke = new THREE.BoxGeometry(0.03, r * 0.78, 0.04).translate(face - 0.01, r * 0.56, 0)
      parts.push(spoke.rotateX(side).rotateX(a))
    }
    const nut = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6).rotateZ(Math.PI / 2)
    parts.push(nut.translate(face + 0.02, r * 0.16, 0).rotateX(a + Math.PI / SPOKES))
  }
  const disc = new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.025, 24).rotateZ(Math.PI / 2)
  parts.push(disc.translate(face - 0.09, 0, 0))
  return mergeGeometries(parts)!
}

/** Tire and rim geometry with their materials, axle along x and rim face toward +x. */
export function wheelParts(radius: number, width: number) {
  return [
    { geometry: tire(radius, width), material: rubber },
    { geometry: rimGeometry(radius, width), material: alloy },
  ]
}
