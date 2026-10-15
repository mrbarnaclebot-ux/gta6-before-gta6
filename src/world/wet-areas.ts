import * as THREE from 'three'
import { SEA_LEVEL, type Rect } from '../city/layout'

// Coarse tiles: a few hundred boxes, cheap to test against the view every frame.
const TILE = 64
const SAMPLE = 8
// Past the terrain grid it is open sea as far as the horizon.
const OPEN_SEA = 20000

/**
 * Boxes around every patch of water: each terrain tile with any ground below sea level,
 * plus the open sea beyond the terrain grid. The water's mirror only renders while one is in view.
 */
export function wetBoxes(height: (x: number, z: number) => number, grid: Rect): THREE.Box3[] {
  const boxes: THREE.Box3[] = []
  const box = (x0: number, z0: number, x1: number, z1: number) =>
    boxes.push(
      new THREE.Box3(
        new THREE.Vector3(x0, SEA_LEVEL - 1, z0),
        new THREE.Vector3(x1, SEA_LEVEL + 1, z1),
      ),
    )
  for (let x = grid.x0; x < grid.x1; x += TILE) {
    for (let z = grid.z0; z < grid.z1; z += TILE) {
      if (anyWet(height, x, z)) box(x, z, x + TILE, z + TILE)
    }
  }
  const { x0, z0, x1, z1 } = grid
  const far = OPEN_SEA
  box(x1, -far, far, far)
  box(-far, -far, x0, far)
  box(x0, -far, x1, z0)
  box(x0, z1, x1, far)
  return boxes
}

function anyWet(height: (x: number, z: number) => number, x0: number, z0: number): boolean {
  for (let x = x0; x <= x0 + TILE; x += SAMPLE) {
    for (let z = z0; z <= z0 + TILE; z += SAMPLE) if (height(x, z) < SEA_LEVEL) return true
  }
  return false
}

const frustum = new THREE.Frustum()
const viewProj = new THREE.Matrix4()

/** True when any of the boxes is inside the camera's view. */
export function seesAny(camera: THREE.Camera, boxes: THREE.Box3[]): boolean {
  viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(viewProj)
  return boxes.some((b) => frustum.intersectsBox(b))
}
