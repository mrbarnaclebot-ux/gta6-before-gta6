import * as THREE from 'three'
import { RAPIER, type PhysicsWorld } from '../physics'
import { FLOAT_DEPTH } from '../player/swim'

const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
const DOWN = { x: 0, y: -1, z: 0 }

/** Driver's side first, then the other side, the back, the front, and last the roof. */
function candidates(b: THREE.Box3): [number, number, number][] {
  return [
    [b.max.x + 0.6, 0, 0],
    [b.min.x - 0.6, 0, 0],
    [0, 0, b.min.z - 1],
    [0, 0, b.max.z + 1.1],
    [0, 1.5, 0],
  ]
}

type Exiting = {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  visual: { bounds: THREE.Box3 }
}

/**
 * Where someone climbing out can stand: the first spot beside the vehicle with dry ground
 * below and room for the capsule (a pier beats the open water beside a boat), else the
 * first with room at all. Returns feet position.
 */
export function findExit(
  physics: PhysicsWorld,
  v: Exiting,
  capsule: { halfHeight: number; radius: number },
  water: (x: number, z: number) => number | null = () => null,
): THREE.Vector3 {
  const shape = new RAPIER.Capsule(capsule.halfHeight, capsule.radius)
  const lift = capsule.halfHeight + capsule.radius + 0.05
  const p = new THREE.Vector3()
  for (const dryOnly of [true, false]) {
    for (const [x, y, z] of candidates(v.visual.bounds)) {
      // The roof ray lands on the vehicle itself, which is not dry ground beside it.
      if (dryOnly && y > 0) continue
      p.set(x, y, z).applyQuaternion(v.quaternion).add(v.position)
      const from = { x: p.x, y: p.y + 2, z: p.z }
      const hit = physics.castRay(new RAPIER.Ray(from, DOWN), 4, true)
      // No ground within reach (deep water, a ledge): keep the door height and let the player fall or swim.
      const ground = hit ? from.y - hit.timeOfImpact + 0.02 : p.y + 0.3
      const surface = water(p.x, p.z)
      const wet = surface !== null && ground < surface
      if (dryOnly && (!hit || wet)) continue
      // Over deep water, come out treading at the surface instead of on the seabed.
      const feet = wet ? Math.max(ground, surface - FLOAT_DEPTH) : ground
      const center = { x: p.x, y: feet + lift, z: p.z }
      if (!physics.intersectionWithShape(center, NO_ROTATION, shape)) return p.setY(feet)
    }
  }
  return p.copy(v.position).setY(v.position.y + 2)
}
