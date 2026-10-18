import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Grounded } from '../city/layout'
import { heightAt } from '../city/terrain'
import { HOUSE_DESIGNS, VILLA_DESIGNS } from '../land/house-designs'
import { VILLA_ROAD, type Villa } from '../land/hillside'
import type { Land } from '../land/plan'
import type { House } from '../land/residential'
import type { P3 } from '../land/polyline'
import { RAPIER } from '../physics'
import { addMerged, tinted, type WorldCtx } from '../world/blocks'
import { groupByChunk } from '../world/chunks'
import { instanceByDistance } from '../world/lod-instances'
import { pbr } from '../world/materials'
import { trimeshCollider } from './bridges'
import { loadHouses } from './house-models'
import { strip, sweep, type Section } from './sweep'

// A 14 cm block garden wall: thick enough to shade its own side and catch the stucco normal map.
const FENCE: Section = [
  [0.07, 1.2],
  [-0.07, 1.2],
  [-0.07, -0.3],
  [0.07, -0.3],
  [0.07, 1.2],
]
const FENCE_TINT = 0xc4bcae
const YARD = 11
/** Past this many meters a house draws its low-detail model. */
const HOUSE_LOD = 100
const VILLA_FORWARD = 0.8
/** Wall paints: Miami pastels, kept below white so the tone mapper never clips them flat in sun. */
const PAINTS = [0xf1ece2, 0xeedcc0, 0xe6cda6, 0xcde3d6, 0xf0dfa4, 0xefc4b0, 0xcfdeea, 0xe2d4e8]

/**
 * Solid parts of each design for the player to bump into, in the model's space (garage at +x):
 * center x and z, width, depth, height. Low garden walls and fences count; porches and
 * pool decks are left open to walk on.
 */
const BOXES: [number, number, number, number, number][][] = [
  [[0, 0, 14, 10, 4.5]],
  [
    [0, 0, 13, 10, 7],
    [-0.7, 5.6, 3, 1.2, 7],
  ],
  [[0, 0, 13, 11, 6.8]],
  [
    [0, 0, 12, 10, 4.2],
    [-3.55, 11, 5.9, 0.3, 0.75],
    [1.45, 11, 1.3, 0.3, 0.75],
  ],
  [
    [0, 0, 12, 9, 4.8],
    [-4.55, 10.5, 3.9, 0.1, 1],
    [0.5, 10.5, 3, 0.1, 1],
  ],
  [
    [-2.75, 0, 8.5, 11, 6.8],
    [4.25, -1, 5.5, 9, 3.4],
    [-4.9, 11.5, 5.2, 0.3, 0.9],
    [0.7, 11.5, 3.8, 0.3, 0.9],
  ],
]

/** A model house standing somewhere: its design, center on the ground, yaw, and mirroring. */
export interface Placed extends P3 {
  design: number
  yaw: number
  flip: boolean
  tint: number
}

/** Points every 2 m along a local-space polyline, turned and placed with the house, on the ground. */
function draped(land: Land, h: Pick<House, 'x' | 'z' | 'yaw'>, local: [number, number][]): P3[] {
  const out: P3[] = []
  const cos = Math.cos(h.yaw)
  const sin = Math.sin(h.yaw)
  for (let k = 0; k + 1 < local.length; k++) {
    const [ax, az] = local[k]
    const [bx, bz] = local[k + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2))
    for (let i = k ? 1 : 0; i <= n; i++) {
      const lx = ax + ((bx - ax) * i) / n
      const lz = az + ((bz - az) * i) / n
      const x = h.x + lx * cos + lz * sin
      const z = h.z - lx * sin + lz * cos
      out.push({ x, y: heightAt(land, x, z), z })
    }
  }
  return out
}

function fence(land: Land, h: House): THREE.BufferGeometry {
  const [w, d] = [h.w / 2 + 3, h.d / 2]
  return sweep(
    draped(land, h, [
      [-w, -d + 1],
      [-w, -d - YARD],
      [w, -d - YARD],
      [w, -d + 1],
    ]),
    FENCE,
  )
}

function driveway(land: Land, h: House): THREE.BufferGeometry {
  const gx = h.garage * (h.w / 2 - 2.2)
  const cos = Math.cos(h.yaw)
  const sin = Math.sin(h.yaw)
  // The curb point in the house's own frame, so the drive runs straight out of the garage.
  const dx = h.curb.x - h.x
  const dz = h.curb.z - h.z
  const curbZ = dx * sin + dz * cos
  const pts = draped(land, h, [
    [gx, h.d / 2],
    [gx, curbZ - 1],
  ]).reverse()
  return sweep(pts, strip(1.7, -1.7, 0.06))
}

/** A villa's drive, straight out of its garage from the terrace's front edge to the road. */
function villaDrive(land: Land, v: Villa): THREE.BufferGeometry {
  const p = villaHouse(v)
  const gx = (p.flip ? -1 : 1) * (HOUSE_DESIGNS[p.design].w / 2 - 2.2)
  const pts = draped(land, p, [
    [gx, v.d / 2 - 0.5 - VILLA_FORWARD],
    [gx, VILLA_ROAD - VILLA_FORWARD],
  ]).reverse()
  return sweep(pts, strip(1.7, -1.7, 0.06))
}

/** The design's boxes as colliders, turned and mirrored with the house. */
export function collideHouse(ctx: WorldCtx, p: Placed): void {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw)
  const cos = Math.cos(p.yaw)
  const sin = Math.sin(p.yaw)
  for (const [bx, bz, w, d, h] of BOXES[p.design]) {
    const x = p.flip ? -bx : bx
    const desc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setTranslation(p.x + x * cos + bz * sin, p.y + h / 2, p.z - x * sin + bz * cos)
      .setRotation(q)
    ctx.colliders.add(desc)
  }
}

/** A villa's house: forward of the pad's middle, so the pool deck behind stops inside the retaining wall. */
function villaHouse(v: Villa): Placed {
  return {
    ...v,
    x: v.x + Math.sin(v.yaw) * VILLA_FORWARD,
    z: v.z + Math.cos(v.yaw) * VILLA_FORWARD,
    design: VILLA_DESIGNS[v.seed % VILLA_DESIGNS.length],
    flip: v.seed % 2 === 1,
    tint: v.seed,
  }
}

/** Every residential house and hillside villa as placed models: the garage on the left is a mirror. */
function placements(land: Land): Placed[] {
  return [...land.houses.map((h) => ({ ...h, flip: h.garage < 0 })), ...land.villas.map(villaHouse)]
}

/**
 * Every house and villa as the Blender models, instanced per design with two levels of
 * detail, painted per house, with colliders; the residential drives and back-yard fences
 * too. Returns the per-frame level-of-detail update.
 */
export async function buildHouses(
  ctx: WorldCtx,
  land: Land,
  load: (url: string) => Promise<GLTF>,
): Promise<(eye: THREE.Vector3) => void> {
  buildYards(ctx, land)
  const models = await loadHouses(load).catch((err: unknown) => {
    console.warn('houses.glb failed to load; the lots stay empty', err)
    return null
  })
  if (!models) return () => {}
  const placed = placements(land)
  const updates = HOUSE_DESIGNS.map((_, k) => {
    const spots: Grounded[] = placed
      .filter((p) => p.design === k)
      .map((p) => ({ ...p, s: 1, r: p.yaw, tint: PAINTS[p.tint % PAINTS.length] }))
    return instanceByDistance(ctx, models[k], spots, {
      scale: () => 1,
      ranges: [HOUSE_LOD],
      // The houses lie in a few hundred meters of the west and the hills: few, big batches.
      chunk: 1000,
    })
  })
  placed.forEach((p) => collideHouse(ctx, p))
  return (eye) => updates.forEach((u) => u(eye))
}

/**
 * Drives and back-yard fences, merged per 250 m chunk, the fences with a trimesh collider;
 * the villas' drives in one more mesh.
 */
function buildYards(ctx: WorldCtx, land: Land): void {
  // The stucco map is about 0.85 grey; times the vertex tint, walls stay below the clip in sun.
  const wall = pbr('white_stucco', 0.5, {
    vertexColors: true,
    normalScale: new THREE.Vector2(2, 2),
  })
  const paving = pbr('concrete_pavement_02', 0.5, { color: 0xeae4da })
  for (const group of groupByChunk(land.houses).values()) {
    const fences = group.map((h) => fence(land, h))
    trimeshCollider(ctx, mergeGeometries(fences))
    addMerged(
      ctx,
      fences.map((f) => tinted(f, FENCE_TINT)),
      wall,
    )
    addMerged(
      ctx,
      group.map((h) => driveway(land, h)),
      paving,
      { cast: false, receive: true },
    )
  }
  // Warm brick pavers, so a villa's drive reads apart from its pale terrace from the air.
  const pavers = pbr('concrete_pavement_02', 0.5, { color: 0xc49a7a })
  const drives = land.villas.map((v) => villaDrive(land, v))
  addMerged(ctx, drives, pavers, { cast: false, receive: true })
}
