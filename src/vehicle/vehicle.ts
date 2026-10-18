import type * as THREE from 'three'
import type { Health } from '../combat/damage'
import type { Surface } from '../combat/effects'
import type { RAPIER } from '../physics'

/** What the driver asks for this step. Boats read throttle and steer; handbrake is a car's. */
export interface Controls {
  throttle: number
  steer: number
  handbrake: boolean
}

/** Anything the player can get into: a car or a boat. Both share the F to enter and exit flow. */
export interface Vehicle {
  readonly kind: 'car' | 'boat'
  readonly collider: InstanceType<typeof RAPIER.Collider>
  /** Interpolated transform for rendering; +z is forward. */
  readonly position: THREE.Vector3
  readonly quaternion: THREE.Quaternion
  /** Forward speed in m/s; negative in reverse. */
  speed: number
  stalled: boolean
  readonly dead: boolean
  readonly health: Health
  /** `bounds` is the hull or chassis box in vehicle space; `seat` the driver's feet. */
  readonly visual: { root: THREE.Object3D; seat: THREE.Vector3; bounds: THREE.Box3 }
  /** One fixed physics step. Null controls: nobody at the wheel. */
  fixedUpdate(dt: number, controls: Controls | null): void
  update(alpha: number, driven?: boolean): void
  place(at: THREE.Vector3, heading?: number): void
  hit(distance: number): Surface
  /** Where engine smoke rises, in world space. */
  hood(out: THREE.Vector3): THREE.Vector3
}
