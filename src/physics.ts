import RAPIER from '@dimforge/rapier3d-compat'

export { RAPIER }
export type PhysicsWorld = InstanceType<typeof RAPIER.World>

export const FIXED_STEP = 1 / 60

/*
 * Collision groups: the high 16 bits say which groups a collider is in, the low 16
 * which groups it interacts with. People and traffic sit in group 2 so the camera's
 * wall probe can look straight through them.
 */
export const ACTOR_GROUPS = 0x0002ffff
export const CAMERA_PROBE_GROUPS = 0x0001fffd
/**
 * Sensors are camera-only shapes (a boat's windshield, which the hull box leaves out):
 * every gameplay query passes this so people, wheels and bullets ignore them.
 */
export const SOLID = RAPIER.QueryFilterFlags.EXCLUDE_SENSORS

export async function createPhysics(): Promise<PhysicsWorld> {
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = FIXED_STEP
  return world
}
