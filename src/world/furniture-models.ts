import * as THREE from 'three'
import type { FurnitureKind } from '../city/furniture'
import { metricBox, tinted } from './blocks'
import { signQuad } from './sign-material'

/*
 * Simple procedural street furniture, each a few dozen triangles, front facing +z, base at
 * y = 0. Each part names the material it is drawn with (furniture.ts merges them by material
 * per chunk). Colors are vertex colors, so one material serves many tints.
 */

export type Mat = 'metal' | 'paint' | 'wood' | 'glass' | 'sign'
export interface Piece {
  mat: Mat
  geo: THREE.BufferGeometry
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: number) =>
  tinted(metricBox(w, h, d).translate(x, y + h / 2, z), color)
const cyl = (r: number, h: number, x: number, y: number, z: number, color: number, n = 10) =>
  tinted(new THREE.CylinderGeometry(r, r, h, n).translate(x, y + h / 2, z), color)

const IRON = 0x2c3034
const NEWS = [0x1f5fa8, 0xc0392b, 0x2e8b57, 0xe0b23a]
const SIGNS = [0xf2f2f2, 0x2f6fb5, 0xd23b2f, 0x2e8b57]

function bench(): Piece[] {
  const wood: THREE.BufferGeometry[] = []
  for (let i = 0; i < 3; i++) wood.push(box(1.8, 0.05, 0.13, 0, 0.43, -0.16 + i * 0.15, 0x9a6b40))
  for (let i = 0; i < 2; i++) {
    const slat = box(1.8, 0.12, 0.04, 0, 0.58 + i * 0.17, 0, 0x9a6b40)
    wood.push(slat.rotateX(-0.18).translate(0, 0, -0.22))
  }
  const metal = [-0.75, 0.75].flatMap((x) => [
    box(0.06, 0.43, 0.06, x, 0, 0.12, IRON),
    box(0.06, 0.8, 0.06, x, 0, -0.2, IRON),
    box(0.06, 0.05, 0.44, x, 0.38, -0.04, IRON),
  ])
  return [
    ...wood.map((geo) => ({ mat: 'wood' as Mat, geo })),
    ...metal.map((geo) => ({ mat: 'metal' as Mat, geo })),
  ]
}

function bin(): Piece[] {
  return [
    { mat: 'paint', geo: cyl(0.27, 0.86, 0, 0, 0, 0x24432f, 12) },
    { mat: 'metal', geo: cyl(0.3, 0.08, 0, 0.86, 0, IRON, 12) },
  ]
}

function hydrant(): Piece[] {
  const red = 0xc8321f
  const side = new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8).rotateZ(Math.PI / 2)
  return [
    { mat: 'paint', geo: cyl(0.13, 0.08, 0, 0, 0, red) },
    { mat: 'paint', geo: cyl(0.1, 0.5, 0, 0.08, 0, red) },
    { mat: 'paint', geo: tinted(new THREE.SphereGeometry(0.11, 10, 6).translate(0, 0.6, 0), red) },
    { mat: 'paint', geo: tinted(side.translate(0, 0.42, 0), red) },
    { mat: 'metal', geo: cyl(0.04, 0.06, 0, 0.42, 0.11, 0xb9a46a, 8) },
  ]
}

function meter(): Piece[] {
  return [
    { mat: 'metal', geo: cyl(0.035, 1.15, 0, 0, 0, IRON, 6) },
    { mat: 'paint', geo: box(0.17, 0.3, 0.13, 0, 1.15, 0, 0x5d6a72) },
    { mat: 'glass', geo: box(0.12, 0.1, 0.01, 0, 1.3, 0.066, 0x1a2328) },
  ]
}

function news(v: number): Piece[] {
  const c = NEWS[v % NEWS.length]
  return [
    { mat: 'paint', geo: box(0.48, 0.85, 0.42, 0, 0.18, 0, c) },
    { mat: 'glass', geo: box(0.36, 0.3, 0.01, 0, 0.62, 0.215, 0x20282c) },
    ...[-0.2, 0.2].map((x) => ({ mat: 'metal' as Mat, geo: box(0.04, 0.18, 0.4, x, 0, 0, IRON) })),
  ]
}

function busStop(v: number): Piece[] {
  const posts = [-1.75, 1.75].flatMap((x) => [
    box(0.07, 2.5, 0.07, x, 0, -0.7, IRON),
    box(0.07, 2.5, 0.07, x, 0, 0.7, IRON),
  ])
  // The ad panel at the shelter's end, a picture on each side.
  const ad = (turn: number, x: number) =>
    signQuad(1.1, 1.75, 8 + (v % 2))
      .translate(0, 0.45, 0)
      .rotateY(turn)
      .translate(x, 0, 0)
  return [
    ...posts.map((geo) => ({ mat: 'metal' as Mat, geo })),
    { mat: 'metal', geo: box(3.7, 0.08, 1.7, 0, 2.5, 0, 0xc9ccce) },
    { mat: 'glass', geo: box(3.4, 1.9, 0.02, 0, 0.45, -0.72, 0x2a3a40) },
    { mat: 'sign', geo: ad(Math.PI / 2, 1.79) },
    { mat: 'sign', geo: ad(-Math.PI / 2, 1.71) },
    ...bench().map((p) => ({ ...p, geo: p.geo.translate(-0.4, 0, -0.35) })),
  ]
}

function sign(v: number): Piece[] {
  return [
    { mat: 'metal', geo: cyl(0.03, 2.6, 0, 0, 0, 0x8e9294, 6) },
    { mat: 'paint', geo: box(0.46, 0.6, 0.02, 0, 2.0, 0.04, SIGNS[v % SIGNS.length]) },
  ]
}

/** The pieces of one item, in its own space. */
export function furniturePieces(kind: FurnitureKind, v: number): Piece[] {
  if (kind === 'bench') return bench()
  if (kind === 'bin') return bin()
  if (kind === 'hydrant') return hydrant()
  if (kind === 'meter') return meter()
  if (kind === 'news') return news(v)
  if (kind === 'bus') return busStop(v)
  return sign(v)
}

/** Half sizes of each item's collider box (x, y, z). */
export const FURNITURE_HALF: Record<FurnitureKind, [number, number, number]> = {
  bench: [0.9, 0.4, 0.3],
  bin: [0.3, 0.45, 0.3],
  hydrant: [0.15, 0.35, 0.15],
  meter: [0.08, 0.7, 0.08],
  news: [0.25, 0.5, 0.22],
  bus: [1.85, 1.3, 0.85],
  sign: [0.05, 1.3, 0.05],
}
