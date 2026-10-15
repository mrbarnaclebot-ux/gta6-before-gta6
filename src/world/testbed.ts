import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RAPIER } from '../physics'
import { block, type WorldCtx } from './blocks'
import { pbr } from './materials'
import { plantPalms } from './palms'
import { tower } from './tower'

/*
 * Phase 1 playground: enough of a Miami block to judge lighting and to exercise
 * the controller (stairs, a walkable ramp, a too-steep ramp, a wall for camera
 * collision). ponytail: hand-placed; Phase 2 replaces it with the seeded city.
 */

function flat(
  ctx: WorldCtx,
  w: number,
  d: number,
  y: number,
  x: number,
  z: number,
  m: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m)
  const uv = mesh.geometry.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(x, y, z)
  mesh.receiveShadow = true
  ctx.scene.add(mesh)
}

function ground(ctx: WorldCtx): void {
  flat(ctx, 1600, 1600, 0, 0, 0, pbr('aerial_grass_rock', 0.25, { color: 0xc8d0a0 }))
  flat(ctx, 60, 80, 0.02, 0, -10, pbr('concrete_pavement_02', 0.5, { color: 0xfbf6ef }))
  flat(ctx, 1600, 14, 0.03, 0, -58, pbr('asphalt_02', 0.25))
  flat(ctx, 14, 1600, 0.031, 38, 0, pbr('asphalt_02', 0.25))
  // 100 m tiles, not one huge box: Rapier's f32 contact math lets the character
  // sink a few centimeters into cuboids hundreds of meters wide.
  for (let x = -750; x <= 750; x += 100) {
    for (let z = -750; z <= 750; z += 100) {
      ctx.physics.createCollider(RAPIER.ColliderDesc.cuboid(50, 1, 50).setTranslation(x, -1, z))
    }
  }
}

function obstacles(ctx: WorldCtx): void {
  const stucco = pbr('white_stucco', 0.5)
  const tile = pbr('concrete_tile_facade', 0.5)
  // Stairs: 0.2 m risers the autostep must climb, up to a 1.2 m terrace.
  for (let i = 0; i < 6; i++) {
    block(ctx, [4, 0.2 * (i + 1), 0.45], [-20, 0.1 * (i + 1), 2 - i * 0.45], tile)
  }
  block(ctx, [10, 1.2, 8], [-20, 0.6, -4.475], tile)
  // A 20 degree ramp you can walk up and a 50 degree one you cannot.
  block(ctx, [4, 0.3, 10], [18, 1.6, 0], tile, new THREE.Euler(0.35, 0, 0))
  block(ctx, [4, 0.3, 6], [24, 2.2, 0], stucco, new THREE.Euler(0.87, 0, 0))
  // Low wall beside spawn so the camera has something to collide with.
  block(ctx, [8, 2.4, 0.4], [-6, 1.2, 17], stucco)
}

// Miami art-deco pastels: white, blush, mint, cream, powder blue.
const PASTELS = [0xf4efe6, 0xf0c3bd, 0xb9e0d0, 0xf2dca8, 0xc4d8ee]
const GLASS_TINTS = [0x5d8f9c, 0x4f7896, 0x6a9a92]

function skyline(ctx: WorldCtx): void {
  const base = pbr('white_stucco', 0.35)
  // Clones share the stucco textures; only the tint differs.
  const stuccos = PASTELS.map((c) => Object.assign(base.clone(), { color: new THREE.Color(c) }))
  const glasses = GLASS_TINTS.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.9, roughness: 0.06 }),
  )
  const towers = [
    { x: -48, z: -28, w: 16, d: 22, floors: 9 },
    { x: 56, z: -18, w: 14, d: 18, floors: 7 },
    { x: -30, z: -92, w: 18, d: 18, floors: 15 },
    { x: 2, z: -100, w: 20, d: 16, floors: 22 },
    { x: 32, z: -88, w: 16, d: 16, floors: 11 },
    { x: -68, z: -125, w: 20, d: 20, floors: 28 },
    { x: 62, z: -135, w: 22, d: 18, floors: 32 },
    { x: 18, z: -175, w: 24, d: 20, floors: 40 },
    { x: -34, z: -205, w: 20, d: 20, floors: 36 },
  ]
  towers.forEach((t, i) => tower(ctx, t, stuccos[i % stuccos.length], glasses[i % glasses.length]))
}

const PALMS: [number, number, number][] = [
  ...[-44, -32, -20, -8, 4, 16].flatMap((z, i): [number, number, number][] => [
    [-10, z, 8 + (i % 3)],
    [10, z + 4, 9 - (i % 2)],
  ]),
  [-26, -48, 11],
  [26, -46, 10],
  [-28, 24, 9],
  [28, 26, 8.5],
]

export async function buildTestbed(
  ctx: WorldCtx,
  load: (url: string) => Promise<GLTF>,
): Promise<void> {
  ground(ctx)
  obstacles(ctx)
  skyline(ctx)
  await plantPalms(ctx, load, PALMS)
}
