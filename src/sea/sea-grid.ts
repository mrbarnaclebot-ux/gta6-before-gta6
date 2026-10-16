import * as THREE from 'three'

// Far past the fog distance so the edge never shows on the horizon.
const HALF = 20000
// Grid lines are packed tight near the middle and spread out with distance (sinh spacing):
// about 0.5 m apart under the camera, 5 m at 100 m, so near waves stay smooth for few vertices.
const LINES = 320
const SPREAD = 8.3

const place = (u: number) => (HALF * Math.sinh(SPREAD * u)) / Math.sinh(SPREAD)

/** Spacing between the middle grid lines: the mesh moves in steps of this, so near vertices never swim. */
export const SEA_GRID_STEP = place(2 / LINES)

/**
 * A square grid in the x/y plane (the water's local plane), dense in the middle.
 * The water and the surface seen from below follow the camera with it.
 */
export function seaGrid(): THREE.BufferGeometry {
  const n = LINES + 1
  const pos = new Float32Array(n * n * 3)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = (j * n + i) * 3
      pos[k] = place((i / LINES) * 2 - 1)
      pos[k + 1] = place((j / LINES) * 2 - 1)
    }
  }
  const index: number[] = []
  for (let j = 0; j < LINES; j++) {
    for (let i = 0; i < LINES; i++) {
      const a = j * n + i
      index.push(a, a + 1, a + n, a + 1, a + n + 1, a + n)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(index)
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), HALF * Math.SQRT2)
  return geo
}

/** Where the grid's middle should sit to follow a camera at (x, z), snapped to the grid step. */
export function gridAnchor(x: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  const s = SEA_GRID_STEP
  return out.set(Math.round(x / s) * s, 0, Math.round(z / s) * s)
}
