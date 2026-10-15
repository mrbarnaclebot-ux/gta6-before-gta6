import * as THREE from 'three'
import { wheelParts } from './wheel-model'

// ponytail: fixed pool per car kind; 30 cars of one kind is far above the 22 the city spawns.
const CAPACITY = 120

type Hub = { pivot: THREE.Object3D; car: THREE.Object3D; flip: boolean }

const FLIP = new THREE.Matrix4().makeRotationY(Math.PI)
const flipped = new THREE.Matrix4()

/**
 * Every wheel of one car kind drawn as two InstancedMeshes (tire and rim): two draw
 * calls per pass instead of eight per car. Cars keep plain pivot objects at the hubs;
 * `sync` copies their world matrices in just before each scene render.
 */
export class WheelBatch {
  readonly meshes: THREE.InstancedMesh[]
  private readonly hubs: Hub[] = []

  constructor(radius: number, width: number) {
    this.meshes = wheelParts(radius, width).map(({ geometry, material }) => {
      const mesh = new THREE.InstancedMesh(geometry, material, CAPACITY)
      mesh.count = 0
      mesh.castShadow = mesh.receiveShadow = true
      // Wheels are spread over the whole city; culling the batch as one sphere would be wrong.
      mesh.frustumCulled = false
      return mesh
    })
  }

  /** `flip` turns the wheel round so the rim faces out on the car's right side. */
  add(pivot: THREE.Object3D, car: THREE.Object3D, flip: boolean): void {
    if (this.hubs.length < CAPACITY) this.hubs.push({ pivot, car, flip })
    else console.warn('Wheel pool full; this wheel is not drawn')
  }

  /** Runs after three has updated world matrices and before it collects objects to draw. */
  sync(): void {
    let n = 0
    for (const { pivot, car, flip } of this.hubs) {
      if (!car.visible || !car.parent) continue
      const m = flip ? flipped.multiplyMatrices(pivot.matrixWorld, FLIP) : pivot.matrixWorld
      for (const mesh of this.meshes) mesh.setMatrixAt(n, m)
      n++
    }
    for (const mesh of this.meshes) {
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    }
  }
}
