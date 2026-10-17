import * as THREE from 'three'
import { CURB_H, ROAD_HALF, SEA_LEVEL, type CityLayout, type Rect } from '../city/layout'
import { CANAL_FLOOR } from '../city/terrain'
import { RAPIER } from '../physics'
import { addMerged, metricBox, rectBox, rectCollider, type WorldCtx } from './blocks'
import { pbr } from './materials'

const WALL = 0.5
// Walls stand 2 cm proud of the slab faces above them so the two never z-fight.
const PROUD = 0.02
const RAIL_H = 1.05
const POST_GAP = 2.4
const STAIR_W = 1.4
const STEP_RUN = 0.4
// Ten steps reach from the bank to just under the surface; two more continue below
// a floating swimmer's feet, so the ramp over them catches the swimmer from the water.
const STEP_RISE = (CURB_H - (SEA_LEVEL - 1.15)) / 10
const STEP_COUNT = 12

/** Seawalls along both banks and across both ends of the canal. */
function walls(c: CityLayout): Rect[] {
  const k = c.canal
  return [
    { ...k, x0: k.x0 - WALL, x1: k.x0 + PROUD },
    { ...k, x0: k.x1 - PROUD, x1: k.x1 + WALL },
    { ...k, z0: k.z0 - WALL, z1: k.z0 + PROUD },
    { ...k, z0: k.z1 - PROUD, z1: k.z1 + WALL },
  ]
}

/** Interior roads cross the canal on short bridges: a deck under the road and two parapets. */
function bridges(c: CityLayout) {
  const k = c.canal
  return c.zRoads.slice(1, -1).map((at) => ({
    deck: { x0: k.x0, x1: k.x1, z0: at - ROAD_HALF - 0.3, z1: at + ROAD_HALF + 0.3 },
    parapets: [-1, 1].map((s) => ({
      x0: k.x0,
      x1: k.x1,
      z0: at + s * ROAD_HALF - 0.2 - s * 0.2,
      z1: at + s * ROAD_HALF + 0.2 - s * 0.2,
    })),
  }))
}

type Step = { r: Rect; top: number }

/**
 * A flight of steps against the seawall: a landing level with the bank, then
 * steps descending along the wall into the water. Returns the steps and the
 * landing's z range, where the railing leaves a gap.
 */
function stairs(wallX: number, side: 1 | -1, z: number) {
  const [x0, x1] = side > 0 ? [wallX, wallX + STAIR_W] : [wallX - STAIR_W, wallX]
  const steps: Step[] = [{ r: { x0, x1, z0: z - STAIR_W, z1: z }, top: CURB_H }]
  for (let k = 1; k <= STEP_COUNT; k++) {
    const r = { x0, x1, z0: z + (k - 1) * STEP_RUN, z1: z + k * STEP_RUN }
    steps.push({ r, top: CURB_H - k * STEP_RISE })
  }
  return { steps, gap: [z - STAIR_W, z] as const }
}

/**
 * The flight collides as a solid wedge from the canal floor up to a smooth
 * slope over the step nosings. Capsules snag on 0.4 m treads; a ramp under
 * visible steps is the usual trick.
 */
function stairRamp(ctx: WorldCtx, landing: Rect, z: number): void {
  const end = z + STEP_COUNT * STEP_RUN
  const low = CURB_H - STEP_COUNT * STEP_RISE
  const points = [landing.x0, landing.x1].flatMap((x) => [
    [x, CURB_H, z],
    [x, low, end],
    [x, CANAL_FLOOR, end],
    [x, CANAL_FLOOR, z],
  ])
  const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(points.flat()))
  if (desc) ctx.physics.createCollider(desc)
}

/** White railing (posts and two rails) along one bank between two bridges. */
function railing(x: number, z0: number, z1: number): THREE.BufferGeometry[] {
  const len = z1 - z0
  const zc = (z0 + z1) / 2
  const parts = [0.5, RAIL_H].map((y) => metricBox(0.06, 0.06, len).translate(x, CURB_H + y, zc))
  for (let z = z0 + 0.3; z <= z1 - 0.3; z += POST_GAP) {
    parts.push(metricBox(0.06, RAIL_H, 0.06).translate(x, CURB_H + RAIL_H / 2, z))
  }
  return parts
}

export function buildCanal(ctx: WorldCtx, c: CityLayout): void {
  const stone = pbr('white_stucco', 0.5, { color: 0xd4ccbc, roughness: 0.95 })
  const metal = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35, metalness: 0.6 })
  const sides = walls(c)
  const crossings = bridges(c)
  const parapets = crossings.flatMap((b) => b.parapets)
  addMerged(
    ctx,
    [
      ...sides.map((r) => rectBox(r, CANAL_FLOOR - 0.2, -PROUD)),
      ...crossings.map((b) => rectBox(b.deck, -0.9, -0.01)),
      ...parapets.map((r) => rectBox(r, 0, 0.9)),
    ],
    stone,
  )
  for (const r of sides) rectCollider(ctx, r, CANAL_FLOOR - 0.2, -PROUD)
  for (const r of parapets) rectCollider(ctx, r, 0, 0.9)
  // ponytail: the decks clear the water by 30 cm, too low for a boat, so they are solid to the
  // canal floor: a boat stops at the bridge instead of squeezing under the road. Raised
  // bridges that boats pass under come with the open canal (Phase 13b).
  for (const b of crossings) rectCollider(ctx, b.deck, CANAL_FLOOR - 0.2, -0.01)
  buildBanks(ctx, c, stone, metal)
}

/** Railings along both banks, broken where a flight of steps leads down into the water. */
function buildBanks(ctx: WorldCtx, c: CityLayout, stone: THREE.Material, metal: THREE.Material) {
  const k = c.canal
  const rails: THREE.BufferGeometry[] = []
  const steps: Step[] = []
  for (let i = 0; i + 1 < c.zRoads.length; i++) {
    const z0 = c.zRoads[i] + ROAD_HALF + 0.3
    const z1 = c.zRoads[i + 1] - ROAD_HALF - 0.3
    // One flight per stretch between bridges, alternating banks.
    const west = i % 2 === 0
    const flight = stairs(west ? k.x0 : k.x1, west ? 1 : -1, (z0 + z1) / 2)
    steps.push(...flight.steps)
    rectCollider(ctx, flight.steps[0].r, CANAL_FLOOR, CURB_H)
    stairRamp(ctx, flight.steps[0].r, (z0 + z1) / 2)
    for (const x of [k.x0 - 0.15, k.x1 + 0.15]) {
      const stairBank = x < k.x0 === west
      const runs = stairBank
        ? [
            [z0, flight.gap[0]],
            [flight.gap[1], z1],
          ]
        : [[z0, z1]]
      for (const [a, b] of runs) {
        rails.push(...railing(x, a, b))
        rectCollider(ctx, { x0: x - 0.05, x1: x + 0.05, z0: a, z1: b }, CURB_H, CURB_H + RAIL_H)
      }
    }
  }
  addMerged(ctx, rails, metal)
  addMerged(
    ctx,
    steps.map((s) => rectBox(s.r, CANAL_FLOOR, s.top)),
    stone,
  )
}
