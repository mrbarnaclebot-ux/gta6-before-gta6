import * as THREE from 'three'
import type { FurnitureKind } from '../city/furniture'
import { metricBox, tinted } from './blocks'
import { signQuad } from './sign-material'

/*
 * Street furniture, front facing +z, base at y = 0: which kinds are Blender models (benches,
 * bins, hydrants, kiosks, bus shelters; instanced by kit-furniture.ts), and the simple
 * procedural meters, newspaper boxes, signs, and shelter ads. Each part names the material it
 * is drawn with (furniture.ts merges them by material per chunk). Colors are vertex colors,
 * so one material serves many tints.
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

/** Pictures from the sign atlas on both faces of the Blender shelter's advert panel. */
function busAds(v: number): Piece[] {
  const ad = (turn: number, x: number) =>
    signQuad(1.0, 1.6, 8 + (v % 2))
      .translate(0, 0.4, 0)
      .rotateY(turn)
      .translate(x, 0, -0.05)
  return [
    { mat: 'sign', geo: ad(Math.PI / 2, 1.835) },
    { mat: 'sign', geo: ad(-Math.PI / 2, 1.665) },
  ]
}

function sign(v: number): Piece[] {
  return [
    { mat: 'metal', geo: cyl(0.03, 2.6, 0, 0, 0, 0x8e9294, 6) },
    { mat: 'paint', geo: box(0.46, 0.6, 0.02, 0, 2.0, 0.04, SIGNS[v % SIGNS.length]) },
  ]
}

/**
 * The kinds drawn as Blender models (kit-furniture.ts): the prop's name, and how far off it
 * is still drawn, in meters (a bus shelter reads from farther than a hydrant).
 */
export const KIT_MODELS: Partial<Record<FurnitureKind, { name: string; reach: number }>> = {
  bench: { name: 'bench', reach: 110 },
  bin: { name: 'bin', reach: 90 },
  hydrant: { name: 'hydrant', reach: 90 },
  kiosk: { name: 'kiosk', reach: 220 },
  bus: { name: 'bus_shelter', reach: 220 },
}

/** The merged pieces of one item, in its own space: none for a Blender model but a shelter's ads. */
export function furniturePieces(kind: FurnitureKind, v: number): Piece[] {
  if (kind === 'bus') return busAds(v)
  if (KIT_MODELS[kind]) return []
  if (kind === 'meter') return meter()
  if (kind === 'news') return news(v)
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
  kiosk: [1.2, 1.26, 1.4],
}
