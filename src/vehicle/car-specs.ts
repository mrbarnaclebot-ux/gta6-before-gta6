import * as THREE from 'three'
import type { Paint } from './car-paint'

export type CarKind = 'sports' | 'police'

/**
 * Where everything sits on each generated body. The bodies come 1 unit long, nose at +z;
 * `size` and the arch positions were measured from the glb's vertices (side profile of the
 * outer skin). Physics uses these numbers, so a car drives the same before its glb loads.
 */
export interface CarSpec {
  url: string
  /** Body bounding box in model units: width, height, length. */
  size: [number, number, number]
  /** Real length in meters; height scales with it. */
  length: number
  /** The generated bodies come out wide for their length: narrow them by this. */
  narrow: number
  /** Body bottom above the ground, meters. */
  clearance: number
  wheel: { radius: number; width: number; x: number; front: number; rear: number }
  /** Light bar's lowest point in model units, or above the roof if there is none. */
  roofLamps: number
  /** Window sills' height in model units: grey texels above it are glass (car-paint.ts). */
  belt: number
  /** Driver's feet in car space while seated. */
  seat: THREE.Vector3
  paints: Paint[]
}

/** Paint turns from the sports car's own orange: orange, red, turquoise, pink, white, black. */
const SPORTS_PAINTS: Paint[] = [
  [0, 1, 1],
  [-0.06, 1.05, 0.8],
  [0.43, 0.9, 0.85],
  [-0.15, 0.9, 1],
  [0, 0.06, 1.55],
  [0, 0.15, 0.22],
]

export const CAR_SPECS: Record<CarKind, CarSpec> = {
  sports: {
    url: '/assets/models/vehicle/sports_car.glb',
    size: [0.57, 0.25, 1],
    length: 4.6,
    narrow: 0.85,
    clearance: 0.11,
    wheel: { radius: 0.34, width: 0.28, x: 0.88, front: 1.2, rear: -1.33 },
    roofLamps: 1,
    belt: 0,
    seat: new THREE.Vector3(0.38, -0.3, -0.2),
    paints: SPORTS_PAINTS,
  },
  police: {
    url: '/assets/models/vehicle/police.glb',
    size: [0.457, 0.306, 1],
    length: 5,
    narrow: 0.85,
    clearance: 0.14,
    wheel: { radius: 0.36, width: 0.25, x: 0.74, front: 1.45, rear: -1.425 },
    roofLamps: 0.13,
    belt: 0.03,
    seat: new THREE.Vector3(0.38, -0.1, -0.1),
    paints: [[0, 1, 1]],
  },
}

export const PAINT_COUNT = SPORTS_PAINTS.length

/** Meters per model unit along each axis. */
export function bodyScale(spec: CarSpec): THREE.Vector3 {
  return new THREE.Vector3(spec.length * spec.narrow, spec.length, spec.length)
}

/** The body's box in car space: ground at y = 0, +z forward. */
export function bodyBounds(spec: CarSpec): THREE.Box3 {
  const half = new THREE.Vector3(...spec.size).multiply(bodyScale(spec)).multiplyScalar(0.5)
  const center = new THREE.Vector3(0, spec.clearance + half.y, 0)
  return new THREE.Box3(center.clone().sub(half), center.clone().add(half))
}
