import * as THREE from 'three'
import { holeTexture } from './textures'

const CAPACITY = 96
const SIZE = 0.22
const Z = new THREE.Vector3(0, 0, 1)

/**
 * Bullet holes as one instanced quad laid flat on the hit surface. A ring buffer:
 * the oldest hole disappears when the pool is full.
 * ponytail: flat quads overhang corners and only land on static world geometry;
 * projected DecalGeometry would wrap edges but needs the hit mesh, which instancing hides.
 */
export class Decals {
  readonly mesh: THREE.InstancedMesh
  private next = 0
  private readonly m = new THREE.Matrix4()
  private readonly q = new THREE.Quaternion()
  private readonly spin = new THREE.Quaternion()
  private readonly s = new THREE.Vector3()

  constructor() {
    const material = new THREE.MeshStandardMaterial({
      map: holeTexture(),
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    })
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, CAPACITY)
    this.mesh.receiveShadow = true
    this.mesh.frustumCulled = false
    this.mesh.count = 0
  }

  add(point: THREE.Vector3, normal: THREE.Vector3): void {
    this.q.setFromUnitVectors(Z, normal)
    this.spin.setFromAxisAngle(Z, Math.random() * Math.PI * 2)
    this.q.multiply(this.spin)
    this.s.setScalar(SIZE * (0.8 + Math.random() * 0.4))
    const at = point.clone().addScaledVector(normal, 0.004)
    this.mesh.setMatrixAt(this.next, this.m.compose(at, this.q, this.s))
    this.next = (this.next + 1) % CAPACITY
    this.mesh.count = Math.min(CAPACITY, this.mesh.count + 1)
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
