import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { heightAt } from '../city/terrain'
import type { Land } from '../land/plan'
import type { House } from '../land/residential'
import type { P3 } from '../land/polyline'
import { RAPIER } from '../physics'
import { addMerged, tinted, type WorldCtx } from '../world/blocks'
import { groupByChunk } from '../world/chunks'
import { pbr } from '../world/materials'
import { trimeshCollider } from './bridges'
import { FLOOR_H, houseParts, type HouseParts } from './house-parts'
import { strip, sweep, type Section } from './sweep'

const FENCE: Section = [
  [0.04, 1.4],
  [-0.04, 1.4],
  [-0.04, -0.3],
  [0.04, -0.3],
  [0.04, 1.4],
]
const YARD = 11

/** Rows of rounded clay or shingle courses, grey, tinted per house by vertex color. */
function roofTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#9a9a9a'
  g.fillRect(0, 0, 256, 256)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 9; col++) {
      const x = col * 32 - (row % 2) * 16
      const grad = g.createLinearGradient(x, 0, x + 32, 0)
      grad.addColorStop(0, '#7a7a7a')
      grad.addColorStop(0.5, '#e6e6e6')
      grad.addColorStop(1, '#7a7a7a')
      g.fillStyle = grad
      g.fillRect(x + 1, row * 32 + 2, 30, 29)
    }
    g.fillStyle = '#444'
    g.fillRect(0, row * 32 + 30, 256, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(0.5, 0.5)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Points every 2 m along a local-space polyline, turned and placed with the house, on the ground. */
function draped(land: Land, h: House, local: [number, number][]): P3[] {
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

function collide(ctx: WorldCtx, h: House): void {
  const height = h.floors * FLOOR_H
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.yaw)
  const desc = RAPIER.ColliderDesc.cuboid(h.w / 2, height / 2, h.d / 2)
    .setTranslation(h.x, h.y + height / 2, h.z)
    .setRotation(q)
  ctx.physics.createCollider(desc)
}

/** Every house, merged per 250 m chunk and material, with drives, back-yard fences, and colliders. */
export function buildHouses(ctx: WorldCtx, land: Land): void {
  const wall = pbr('white_stucco', 0.5, { vertexColors: true })
  const roof = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    side: THREE.DoubleSide,
  })
  roof.map = roof.bumpMap = roofTexture()
  roof.bumpScale = 2
  // Sky-reflecting panes: dark enough to read as glass, light enough not to look like holes.
  const glass = new THREE.MeshStandardMaterial({
    color: 0x4f6878,
    roughness: 0.06,
    metalness: 0.35,
  })
  const trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 })
  const paving = pbr('concrete_pavement_02', 0.5, { color: 0xeae4da })
  for (const group of groupByChunk(land.houses).values()) {
    const p: HouseParts = { wall: [], roof: [], glass: [], trim: [] }
    for (const h of group) houseParts(h, p)
    addMerged(ctx, p.wall, wall)
    addMerged(ctx, p.roof, roof)
    addMerged(ctx, p.glass, glass)
    const fences = group.map((h) => fence(land, h))
    trimeshCollider(ctx, mergeGeometries(fences))
    addMerged(ctx, [...p.trim, ...fences.map((f) => tinted(f, 0xededed))], trim)
    addMerged(
      ctx,
      group.map((h) => driveway(land, h)),
      paving,
      { cast: false, receive: true },
    )
    group.forEach((h) => collide(ctx, h))
  }
}
