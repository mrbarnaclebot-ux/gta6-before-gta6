import * as THREE from 'three'
import { RAPIER, SOLID, type PhysicsWorld } from '../physics'

type Collider = InstanceType<typeof RAPIER.Collider>

const REACH = 1.0
// Highest ledge above the feet a swimmer can pull up onto: a seawall or a step, not a railing.
const MAX_CLIMB = 2.9
const MIN_CLIMB = 0.5
const DOWN = { x: 0, y: -1, z: 0 }
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }

/**
 * Where a swimmer facing `heading` can climb out: a flat top within reach and
 * climbing height, with nothing (a railing, a wall) between them and it, and
 * room for the capsule to stand there. Returns the new feet position or null.
 */
export function findLedge(
  physics: PhysicsWorld,
  self: Collider,
  feet: THREE.Vector3,
  heading: number,
  capsule: { halfHeight: number; radius: number },
): THREE.Vector3 | null {
  const dir = { x: Math.sin(heading), y: 0, z: Math.cos(heading) }
  const x = feet.x + dir.x * REACH
  const z = feet.z + dir.z * REACH
  const fromY = feet.y + MAX_CLIMB + 0.1
  const down = physics.castRay(new RAPIER.Ray({ x, y: fromY, z }, DOWN), MAX_CLIMB, true, SOLID)
  if (!down) return null
  const top = fromY - down.timeOfImpact
  if (top - feet.y < MIN_CLIMB) return null
  const across = new RAPIER.Ray({ x: feet.x, y: top + 0.6, z: feet.z }, dir)
  if (physics.castRay(across, REACH, true, SOLID, undefined, self)) return null
  const center = { x, y: top + capsule.halfHeight + capsule.radius + 0.05, z }
  const shape = new RAPIER.Capsule(capsule.halfHeight, capsule.radius)
  if (physics.intersectionWithShape(center, NO_ROTATION, shape, SOLID, undefined, self)) {
    return null
  }
  return new THREE.Vector3(x, top + 0.02, z)
}
