import * as THREE from 'three'

export type CarKind = 'sports' | 'police' | 'sedan' | 'suv' | 'pickup' | 'van'

/**
 * Where everything sits on each Blender body (assets-src/blender/car_specs.py), in meters:
 * origin on the ground midway between the axles, nose at +z. Physics uses these numbers, so
 * a car drives the same before its glb loads; car-model.test.ts checks them against the glbs.
 */
export interface CarSpec {
  url: string
  /** Body width without mirrors, and roof height above the ground. */
  width: number
  height: number
  /** Nose and tail along z. */
  front: number
  rear: number
  /** Body bottom above the ground. */
  clearance: number
  wheel: { radius: number; width: number; x: number; front: number; rear: number }
  /** Driver's feet in car space while seated: the glb's hip point less the sitting pose's 0.6 m. */
  seat: THREE.Vector3
  /** Paint colors (sRGB), picked by variant. */
  paints: number[]
}

const url = (name: string) => `/assets/models/vehicle/car_${name}.glb`
const axles = (radius: number, width: number, x: number, z: number) => ({
  radius,
  width,
  x,
  front: z,
  rear: -z,
})
const hip = (x: number, y: number, z: number) => new THREE.Vector3(x, y - 0.6, z + 0.05)

// Miami traffic: mostly white, silver and black, a few deep colors; sports cars go loud.
const WHITE = 0xe9e9e4
const SILVER = 0xa6aaaf
const BLACK = 0x0c0d0f
const GREY = 0x51555a
const NAVY = 0x1b2b4a

export const CAR_SPECS: Record<CarKind, CarSpec> = {
  sports: {
    ...{ url: url('sports'), width: 2.06, height: 1.24, front: 2.365, rear: -2.235 },
    clearance: 0.11,
    wheel: axles(0.34, 0.28, 0.88, 1.265),
    seat: hip(0.37, 0.3, -0.3),
    paints: [0xe0623a, 0xa90a12, 0x0f9fa3, 0xd9346e, WHITE, BLACK],
  },
  police: {
    ...{ url: url('police'), width: 1.92, height: 1.58, front: 2.4875, rear: -2.5125 },
    clearance: 0.14,
    wheel: axles(0.36, 0.25, 0.8, 1.4375),
    seat: hip(0.37, 0.5, -0.15),
    paints: [BLACK],
  },
  sedan: {
    ...{ url: url('sedan'), width: 1.84, height: 1.44, front: 2.47, rear: -2.38 },
    clearance: 0.14,
    wheel: axles(0.335, 0.225, 0.79, 1.41),
    seat: hip(0.37, 0.46, -0.18),
    paints: [WHITE, SILVER, BLACK, NAVY, 0x5a1119, 0xc8b796, GREY],
  },
  suv: {
    ...{ url: url('suv'), width: 1.93, height: 1.81, front: 2.375, rear: -2.475 },
    clearance: 0.2,
    wheel: axles(0.375, 0.255, 0.84, 1.425),
    seat: hip(0.37, 0.72, -0.15),
    paints: [WHITE, BLACK, 0x383b40, SILVER, 0x1f3a30, NAVY],
  },
  pickup: {
    ...{ url: url('pickup'), width: 2, height: 1.88, front: 2.75, rear: -2.85 },
    clearance: 0.22,
    wheel: axles(0.4, 0.27, 0.86, 1.75),
    seat: hip(0.37, 0.85, 0.45),
    paints: [WHITE, 0x8e1a16, BLACK, SILVER, 0x22334f, 0xb39a74],
  },
  van: {
    ...{ url: url('van'), width: 2, height: 2.21, front: 2.55, rear: -2.75 },
    clearance: 0.16,
    wheel: axles(0.355, 0.235, 0.87, 1.65),
    seat: hip(0.37, 0.78, 1.05),
    paints: [WHITE, WHITE, SILVER, 0x8fb3c9, BLACK],
  },
}

/** Parked and traffic cars that are not police, weighted toward the everyday kinds. */
const CIVILIAN: CarKind[] = ['sedan', 'suv', 'sedan', 'sports', 'suv', 'pickup', 'van']

/** Variants per civilian car: a kind and a paint each (fleet.ts, traffic.ts). */
export const VARIANTS = CIVILIAN.length * 8

/** The civilian kind a variant number stands for. */
export function civilian(variant: number): CarKind {
  return CIVILIAN[variant % CIVILIAN.length]
}

/** A variant's paint: the rest of the number after the kind, so kind and color vary apart. */
export function paintOf(spec: CarSpec, variant: number): number {
  return spec.paints[Math.floor(variant / CIVILIAN.length) % spec.paints.length]
}

/** The body's box in car space: ground at y = 0, +z forward, mirrors left out. */
export function bodyBounds(spec: CarSpec): THREE.Box3 {
  const w = spec.width / 2
  return new THREE.Box3(
    new THREE.Vector3(-w, spec.clearance, spec.rear),
    new THREE.Vector3(w, spec.height, spec.front),
  )
}
