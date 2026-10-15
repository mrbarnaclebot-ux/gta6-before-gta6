import * as THREE from 'three'
import { CURB_H, ROAD_HALF, type CityLayout, type Rect } from '../city/layout'
import { CANAL_FLOOR } from '../city/terrain'
import { addMerged, metricBox, rectBox, rectCollider, type WorldCtx } from './blocks'
import { pbr } from './materials'

const WALL = 0.5
// Walls stand 2 cm proud of the slab faces above them so the two never z-fight.
const PROUD = 0.02
const RAIL_H = 1.05
const POST_GAP = 2.4

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
  const k = c.canal
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

  const rails: THREE.BufferGeometry[] = []
  for (let i = 0; i + 1 < c.zRoads.length; i++) {
    const z0 = c.zRoads[i] + ROAD_HALF + 0.3
    const z1 = c.zRoads[i + 1] - ROAD_HALF - 0.3
    for (const x of [k.x0 - 0.15, k.x1 + 0.15]) {
      rails.push(...railing(x, z0, z1))
      rectCollider(ctx, { x0: x - 0.05, x1: x + 0.05, z0, z1 }, CURB_H, CURB_H + RAIL_H)
    }
  }
  addMerged(ctx, rails, metal)
}
