import { beforeAll, describe, expect, it } from 'vitest'
import type { Billboard } from '../land/billboards'
import { RAPIER, SOLID, initPhysics } from '../physics'
import { billboardColliders } from './billboards'

// The player's capsule and controller settings (src/player/player.ts).
const HALF_HEIGHT = 0.55
const RADIUS = 0.35
const RUN = 6.5
const STEP = 1 / 60

/** Runs a capsule at 6.5 m/s from `from` toward `to` for two seconds; returns where it stopped. */
function run(board: Billboard, from: { x: number; z: number }, to: { x: number; z: number }) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, board.y - 0.5, 0))
  for (const d of billboardColliders(board)) world.createCollider(d)
  const y = board.y + HALF_HEIGHT + RADIUS + 0.02
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(from.x, y, from.z),
  )
  const capsule = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), body)
  const controller = world.createCharacterController(0.02)
  controller.enableAutostep(0.45, 0.2, false)
  const len = Math.hypot(to.x - from.x, to.z - from.z)
  const v = {
    x: ((to.x - from.x) / len) * RUN * STEP,
    y: -0.05,
    z: ((to.z - from.z) / len) * RUN * STEP,
  }
  for (let i = 0; i < 120; i++) {
    world.step()
    controller.computeColliderMovement(capsule, v, SOLID)
    const m = controller.computedMovement()
    const p = body.translation()
    body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z })
  }
  world.step()
  return body.translation()
}

describe('billboard colliders', () => {
  beforeAll(initPhysics)

  // A roof board at an angle, so the colliders must turn with the steel.
  const roof: Billboard = { x: 10, y: 20, z: -5, r: 0.7, layer: 8, pole: false }
  const turn = (x: number, z: number) => ({
    x: roof.x + x * Math.cos(roof.r) + z * Math.sin(roof.r),
    z: roof.z - x * Math.sin(roof.r) + z * Math.cos(roof.r),
  })

  it('stops a runner at a leg instead of letting him walk through it', () => {
    // The left leg stands at local (-W/3, -0.3); run at it from 3 m behind the board.
    const leg = turn(-10 / 3, -0.3)
    const end = run(roof, turn(-10 / 3, -3.3), turn(-10 / 3, 3))
    const along = (end.x - leg.x) * Math.sin(roof.r) + (end.z - leg.z) * Math.cos(roof.r)
    expect(along).toBeLessThan(-0.125 - RADIUS + 0.05)
  })

  it('lets him walk under the catwalk between the legs, as on a real roof board', () => {
    const end = run(roof, turn(0, -3.3), turn(0, 3))
    const along = (end.x - roof.x) * Math.sin(roof.r) + (end.z - roof.z) * Math.cos(roof.r)
    expect(along).toBeGreaterThan(2)
  })

  it('puts the pole collider under the pole', () => {
    const pole: Billboard = { ...roof, pole: true }
    const solid = billboardColliders(pole).find((d) => d.shape.type === RAPIER.ShapeType.Cylinder)!
    const at = turn(0, -0.4)
    expect(solid.translation.x).toBeCloseTo(at.x, 5)
    expect(solid.translation.z).toBeCloseTo(at.z, 5)
  })
})
