import * as THREE from 'three'
import { RAPIER, type PhysicsWorld } from '../physics'

const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
const DOWN = { x: 0, y: -1, z: 0 }
// Driver's door first, then the other side, the back, the front, and last the roof.
const CANDIDATES: [number, number, number][] = [
  [1.7, 0, 0],
  [-1.7, 0, 0],
  [0, 0, -3.3],
  [0, 0, 3.4],
  [0, 1.5, 0],
]

/**
 * Where someone climbing out of the car can stand: the first spot beside it with
 * ground (or water) below and room for the capsule. Returns feet position.
 */
export function findExit(
  physics: PhysicsWorld,
  car: { position: THREE.Vector3; quaternion: THREE.Quaternion },
  capsule: { halfHeight: number; radius: number },
): THREE.Vector3 {
  const shape = new RAPIER.Capsule(capsule.halfHeight, capsule.radius)
  const lift = capsule.halfHeight + capsule.radius + 0.05
  const p = new THREE.Vector3()
  for (const [x, y, z] of CANDIDATES) {
    p.set(x, y, z).applyQuaternion(car.quaternion).add(car.position)
    const from = { x: p.x, y: p.y + 2, z: p.z }
    const hit = physics.castRay(new RAPIER.Ray(from, DOWN), 4, true)
    // No ground within reach (deep water, a ledge): keep the door height and let the player fall or swim.
    const feet = hit ? from.y - hit.timeOfImpact + 0.02 : p.y + 0.3
    const center = { x: p.x, y: feet + lift, z: p.z }
    if (!physics.intersectionWithShape(center, NO_ROTATION, shape)) return p.setY(feet)
  }
  return p.copy(car.position).setY(car.position.y + 2)
}
