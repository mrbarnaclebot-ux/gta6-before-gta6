import RAPIER from '@dimforge/rapier3d-compat'

export { RAPIER }
export type PhysicsWorld = InstanceType<typeof RAPIER.World>

export const FIXED_STEP = 1 / 60

/*
 * Collision groups: the high 16 bits say which groups a collider is in, the low 16
 * which groups it interacts with. People sit in group 2 so the camera's wall probe can
 * look straight through them. Traffic has its own group the probe does see: a car that
 * stops behind the player is solid, and the camera stays in front of it, not inside.
 */
export const ACTOR_GROUPS = 0x0002ffff
export const TRAFFIC_GROUPS = 0x0004ffff
export const CAMERA_PROBE_GROUPS = 0x0001fffd
/**
 * Sensors are camera-only shapes (a boat's windshield, which the hull box leaves out):
 * every gameplay query passes this so people, wheels and bullets ignore them.
 */
export const SOLID = RAPIER.QueryFilterFlags.EXCLUDE_SENSORS

let wasm: Promise<void> | null = null

/** Decodes and compiles Rapier's WASM once: the title screen starts it so Play does not wait. */
export const initPhysics = () => (wasm ??= RAPIER.init())

export async function createPhysics(): Promise<PhysicsWorld> {
  await initPhysics()
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = FIXED_STEP
  // ponytail: Rapier 0.21's step() re-maps every body and collider through a JS callback each
  // time (for soft bodies, which this game has none of): with tens of thousands of static
  // colliders that was most of the frame. Creating and removing still keep the JS maps right.
  // Drop this line if soft bodies are ever used, or once Rapier makes the scan incremental.
  world.mapNewSoftBodies = () => {}
  return world
}
