import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * Procedural wheels: the generated car bodies come without any. A lathed tire with a
 * rounded shoulder and a five-spoke alloy, about 900 triangles, axle along x, rim face
 * toward +x. Two materials, so each wheel is two draw calls.
 */

const SPOKES = 5

const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.92 })
const alloy = new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 1, roughness: 0.32 })

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
  for (let i = 0; i < SPOKES; i++) {
    const spoke = new THREE.BoxGeometry(0.035, r * 0.8, 0.07).translate(face - 0.01, r * 0.55, 0)
    parts.push(spoke.rotateX((i / SPOKES) * Math.PI * 2))
  }
  return mergeGeometries(parts)!
}

/** One wheel mesh to clone per hub; flip it for the right side so the rim faces out. */
export function wheelModel(radius: number, width: number): THREE.Object3D {
  const wheel = new THREE.Group()
  for (const [geo, mat] of [
    [tire(radius, width), rubber],
    [rimGeometry(radius, width), alloy],
  ] as const) {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    wheel.add(mesh)
  }
  return wheel
}
