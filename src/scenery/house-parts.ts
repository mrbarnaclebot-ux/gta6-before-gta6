import * as THREE from 'three'
import type { House } from '../land/residential'
import { metricBox, tinted } from '../world/blocks'

/*
 * One Florida ranch or two-storey house in local space: floor at y = 0, front facing +z,
 * width along x. Stucco walls, a gabled roof, framed windows, a door, and a garage door.
 */

export const FLOOR_H = 3
const WALLS = [0xf4efe6, 0xefe3cf, 0xe9d8c4, 0xdbe6ea, 0xf0dcd0, 0xdfe8d8, 0xf3e8c8, 0xe8e2f0]
const ROOFS = [0xa8573a, 0x5d636a, 0x6e4a3a, 0x8f8b84]
// Trim below pure white: the tone mapper clips anything brighter to a flat sheet in sun.
const TRIM = 0xe6e3dc
const SILL = 0xcfc9be
const DOOR = 0x4a3326
const GARAGE = 0xd9d5cc
const SEAM = 0x33312d
const PLINTH = 0x9a9387
// Window and door surrounds stand this far proud of the wall, so the reveal reads in shadow and AO.
const REVEAL = 0.16
const FRAME = 0.12
// Houses sink this far into their pad, so a sloping yard never shows a gap under the wall.
const SINK = 0.8

export interface HouseParts {
  wall: THREE.BufferGeometry[]
  roof: THREE.BufferGeometry[]
  glass: THREE.BufferGeometry[]
  trim: THREE.BufferGeometry[]
}

/** A gabled roof over a w x d box: ridge along x, `over` meters of overhang, eaves at y0. */
function gable(w: number, d: number, y0: number, over: number): THREE.BufferGeometry {
  const [hw, hd, rise] = [w / 2 + over, d / 2 + over, (d / 2) * 0.48]
  const top = y0 + rise
  const slope = Math.hypot(hd, rise)
  // Two slopes (quads) and two gable ends (triangles); UVs in meters for the tile texture.
  const quad = (z: number, dir: 1 | -1) => [
    [-hw * dir, y0, z],
    [hw * dir, y0, z],
    [hw * dir, top, 0],
    [-hw * dir, top, 0],
  ]
  const end = (x: number, dir: 1 | -1) => [
    [x, y0, (dir * d) / 2],
    [x, top - 0.02, 0],
    [x, y0, (-dir * d) / 2],
  ]
  const pos = [...quad(hd, 1), ...quad(-hd, -1), ...end(-w / 2, 1), ...end(w / 2, -1)].flat()
  const slopeUv = [0, 0, 2 * hw, 0, 2 * hw, slope, 0, slope]
  const endUv = [0, 0, d / 2, rise, d, 0]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute([...slopeUv, ...slopeUv, ...endUv, ...endUv], 2),
  )
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 11, 12, 13])
  geo.computeVertexNormals()
  return geo
}

/** Head and two jambs around a w x h opening centered at (x, y) on the face at z. */
function surround(p: HouseParts, x: number, y: number, w: number, h: number, z: number) {
  const zc = z + REVEAL / 2
  p.trim.push(
    tinted(metricBox(w + 2 * FRAME, FRAME, REVEAL).translate(x, y + (h + FRAME) / 2, zc), TRIM),
    tinted(metricBox(FRAME, h, REVEAL).translate(x - (w + FRAME) / 2, y, zc), TRIM),
    tinted(metricBox(FRAME, h, REVEAL).translate(x + (w + FRAME) / 2, y, zc), TRIM),
  )
}

/** A window set back in its surround, with a sill and a center mullion. */
function window(p: HouseParts, x: number, y: number, w: number, h: number, z: number) {
  surround(p, x, y, w, h, z)
  const sill = metricBox(w + 0.4, 0.07, REVEAL + 0.08)
  p.trim.push(
    tinted(sill.translate(x, y - h / 2 - 0.035, z + (REVEAL + 0.08) / 2), SILL),
    tinted(metricBox(0.05, h, 0.05).translate(x, y, z + 0.06), TRIM),
  )
  p.glass.push(metricBox(w, h, 0.02).translate(x, y, z + 0.02))
}

/** Front door and a four-panel sectional garage door; the dark backing shows in the panel seams. */
function doors(p: HouseParts, door: number, garage: number, z: number) {
  surround(p, door, 1.1, 1.0, 2.2, z)
  p.trim.push(tinted(metricBox(1.0, 2.2, 0.06).translate(door, 1.1, z + 0.04), DOOR))
  surround(p, garage, 1.2, 3.0, 2.4, z)
  p.trim.push(tinted(metricBox(3.0, 2.4, 0.04).translate(garage, 1.2, z + 0.02), SEAM))
  for (let k = 0; k < 4; k++) {
    const panel = metricBox(2.94, 0.56, 0.05).translate(garage, 0.32 + k * 0.6, z + 0.065)
    p.trim.push(tinted(panel, GARAGE))
  }
}

/** Windows along one face of width `span`, skipping the slot [skip0, skip1] (door or garage). */
function windowRow(
  p: HouseParts,
  span: number,
  y: number,
  z: number,
  skip: [number, number] | null,
) {
  const n = Math.max(1, Math.floor(span / 3.4))
  for (let k = 0; k < n; k++) {
    const x = -span / 2 + (span / n) * (k + 0.5)
    if (skip && x > skip[0] - 1 && x < skip[1] + 1) continue
    window(p, x, y, 1.3, 1.4, z)
  }
}

const turn = (geos: THREE.BufferGeometry[], from: number, yaw: number) => {
  for (let i = from; i < geos.length; i++) geos[i].rotateY(yaw)
}

/** Framed windows on all four faces of every floor, leaving room for the door and garage in front. */
function houseWindows(h: House, p: HouseParts, gap: [number, number]): void {
  for (let f = 0; f < h.floors; f++) {
    const y = f * FLOOR_H + 1.6
    const faces: [number, number, number, [number, number] | null][] = [
      [0, h.w, h.d / 2, f ? null : gap],
      [Math.PI, h.w, h.d / 2, null],
      [Math.PI / 2, h.d, h.w / 2, null],
      [-Math.PI / 2, h.d, h.w / 2, null],
    ]
    for (const [yaw, span, z, skip] of faces) {
      const g0 = p.glass.length
      const t0 = p.trim.length
      windowRow(p, span, y, z, skip)
      turn(p.glass, g0, yaw)
      turn(p.trim, t0, yaw)
    }
  }
}

/** Every part of one house, placed in the world. */
export function houseParts(h: House, p: HouseParts): void {
  const lists = [p.wall, p.roof, p.glass, p.trim]
  const start = lists.map((l) => l.length)
  const height = h.floors * FLOOR_H
  const wall = metricBox(h.w, height + SINK, h.d).translate(0, (height - SINK) / 2, 0)
  p.wall.push(tinted(wall, WALLS[h.tint % WALLS.length]))
  // A darker base course a few cm proud of the wall, the way rendered block houses are finished.
  const base = metricBox(h.w + 0.06, SINK + 0.4, h.d + 0.06).translate(0, (0.4 - SINK) / 2, 0)
  p.wall.push(tinted(base, PLINTH))
  p.roof.push(tinted(gable(h.w, h.d, height, 0.55), ROOFS[h.roof]))
  const garage = h.garage * (h.w / 2 - 2.2)
  const door = -h.garage * 0.8
  doors(p, door, garage, h.d / 2)
  houseWindows(h, p, [Math.min(garage, door) - 1.5, Math.max(garage, door) + 1.5])
  lists.forEach((list, k) => {
    for (let i = start[k]; i < list.length; i++) list[i].rotateY(h.yaw).translate(h.x, h.y, h.z)
  })
}
