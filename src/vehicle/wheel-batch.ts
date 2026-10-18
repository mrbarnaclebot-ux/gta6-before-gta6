import * as THREE from 'three'
import type { Part } from '../world/instancing'

// ponytail: fixed pool per car kind: 40 cars. The city parks 18 cars across five civilian
// kinds and traffic runs 12, and carjacking keeps at most MAX_STOLEN (life/carjack-rules.ts)
// more per kind; raise this if any of them grows.
const CAPACITY = 160
/** Past this many meters from the camera a car and its wheels draw their low-detail level. */
export const CAR_LOD = 70

type Hub = { pivot: THREE.Object3D; car: THREE.Object3D; flip: boolean }

const FLIP = new THREE.Matrix4().makeRotationY(Math.PI)
const flipped = new THREE.Matrix4()
const at = new THREE.Vector3()

/**
 * Every wheel of one car kind drawn as instanced meshes, one set per level of detail: a
 * draw call or two per level instead of eight per car. Cars keep plain pivot objects at
 * the hubs; `sync` copies their world matrices in just before each scene render.
 */
export class WheelBatch {
  /** Meshes per level, nearest first. */
  levels: THREE.InstancedMesh[][] = []
  private readonly hubs: Hub[] = []

  constructor(levels: Part[][]) {
    this.setLevels(levels)
  }

  /** Swaps in new wheel models (the glb's, once loaded); returns the old meshes to remove. */
  setLevels(levels: Part[][]): THREE.InstancedMesh[] {
    const old = this.meshes
    this.levels = levels.map((parts) =>
      parts.map(({ geometry, material }) => {
        const mesh = new THREE.InstancedMesh(geometry, material, CAPACITY)
        mesh.count = 0
        mesh.castShadow = mesh.receiveShadow = true
        // Wheels are spread over the whole city; culling the batch as one sphere would be wrong.
        mesh.frustumCulled = false
        return mesh
      }),
    )
    return old
  }

  get meshes(): THREE.InstancedMesh[] {
    return this.levels.flat()
  }

  /** `flip` turns the wheel round so the rim faces out on the car's right side. */
  add(pivot: THREE.Object3D, car: THREE.Object3D, flip: boolean): void {
    if (this.hubs.length < CAPACITY) this.hubs.push({ pivot, car, flip })
    else console.warn('Wheel pool full; this wheel is not drawn')
  }

  /** Runs after three has updated world matrices and before it collects objects to draw. */
  sync(eye: THREE.Vector3): void {
    const counts = this.levels.map(() => 0)
    const far = this.levels.length - 1
    for (const { pivot, car, flip } of this.hubs) {
      if (!car.visible || !car.parent) continue
      const m = flip ? flipped.multiplyMatrices(pivot.matrixWorld, FLIP) : pivot.matrixWorld
      const k = at.setFromMatrixPosition(m).distanceTo(eye) > CAR_LOD ? far : 0
      for (const mesh of this.levels[k]) mesh.setMatrixAt(counts[k], m)
      counts[k]++
    }
    this.levels.forEach((list, k) => {
      for (const mesh of list) {
        mesh.count = counts[k]
        mesh.visible = counts[k] > 0
        mesh.instanceMatrix.needsUpdate = true
      }
    })
  }
}
