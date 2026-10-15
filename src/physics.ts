import RAPIER from '@dimforge/rapier3d-compat'

export { RAPIER }
export type PhysicsWorld = InstanceType<typeof RAPIER.World>

export const FIXED_STEP = 1 / 60

export async function createPhysics(): Promise<PhysicsWorld> {
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = FIXED_STEP
  return world
}
