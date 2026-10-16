import * as THREE from 'three'
import type { Building, Style } from '../city/lots'
import { rng, type Rand } from '../city/rng'
import { metricBox, tinted } from './blocks'

/*
 * Rooftop clutter: AC units, water tanks on legs, and antennas, merged into each chunk's
 * trim mesh (no extra draw calls). Every roof keeps its north-west corner clear, where the
 * rooftop landmark stands the player (city.ts), and the stair or machine core in its middle.
 */

const STEEL = 0x9a9ea1
const DARK = 0x5d6266
const TANK = 0x8f8676
/** The north-west corner kept clear, in meters from each wall. */
const CLEAR = 6

/** What goes onto roofs: the trim geometry and the solid boxes the player stands against. */
export interface RoofOut {
  trim: THREE.BufferGeometry[]
  solids: THREE.Box3[]
}

const COUNT: Record<Style, [number, number]> = { glass: [3, 7], residential: [2, 6], deco: [1, 4] }

/** A free spot on a w x d roof: off the core (`core` x `core` share of the roof) and the clear corner. */
function spot(r: Rand, w: number, d: number, core: number, size: number): [number, number] | null {
  for (let tries = 0; tries < 6; tries++) {
    const x = (r() - 0.5) * (w - 2 - size)
    const z = (r() - 0.5) * (d - 2 - size)
    const inCore = Math.abs(x) < (w * core) / 2 + size && Math.abs(z) < (d * core) / 2 + size
    const inCorner = x < -w / 2 + CLEAR && z < -d / 2 + CLEAR
    if (!inCore && !inCorner) return [x, z]
  }
  return null
}

function acUnit(out: RoofOut, b: Building, x: number, y: number, z: number, big: boolean) {
  const [w, h, d] = big ? [2.6, 1.7, 2.6] : [1.1, 0.8, 1.5]
  out.trim.push(tinted(metricBox(w, h, d).translate(b.x + x, y + h / 2, b.z + z), STEEL))
  // The fan grille on top, dark so the unit reads from above.
  const fan = metricBox(w * 0.7, 0.06, d * 0.7).translate(b.x + x, y + h + 0.03, b.z + z)
  out.trim.push(tinted(fan, DARK))
  const min = new THREE.Vector3(b.x + x - w / 2, y, b.z + z - d / 2)
  out.solids.push(new THREE.Box3(min, new THREE.Vector3(b.x + x + w / 2, y + h, b.z + z + d / 2)))
}

function waterTank(out: RoofOut, b: Building, x: number, y: number, z: number) {
  const tank = new THREE.CylinderGeometry(1.3, 1.3, 2.4, 10).translate(b.x + x, y + 3.2, b.z + z)
  const cap = new THREE.ConeGeometry(1.4, 0.7, 10).translate(b.x + x, y + 4.75, b.z + z)
  out.trim.push(tinted(tank, TANK), tinted(cap, TANK))
  for (const [lx, lz] of [
    [-0.9, -0.9],
    [0.9, -0.9],
    [-0.9, 0.9],
    [0.9, 0.9],
  ]) {
    const leg = metricBox(0.16, 2, 0.16).translate(b.x + x + lx, y + 1, b.z + z + lz)
    out.trim.push(tinted(leg, DARK))
  }
  const min = new THREE.Vector3(b.x + x - 1.3, y, b.z + z - 1.3)
  out.solids.push(new THREE.Box3(min, new THREE.Vector3(b.x + x + 1.3, y + 5, b.z + z + 1.3)))
}

function antenna(out: RoofOut, b: Building, x: number, y: number, z: number, tall: number) {
  out.trim.push(
    tinted(
      new THREE.CylinderGeometry(0.05, 0.08, tall, 5).translate(b.x + x, y + tall / 2, b.z + z),
      DARK,
    ),
    tinted(metricBox(1.2, 0.05, 0.05).translate(b.x + x, y + tall * 0.7, b.z + z), DARK),
    tinted(metricBox(0.8, 0.05, 0.05).translate(b.x + x, y + tall * 0.85, b.z + z), DARK),
  )
}

/** Clutter for the roof of `b`, a w x d deck at height `top` with a centered core of share `core`. */
export function roofClutter(b: Building, top: number, w: number, d: number, core: number): RoofOut {
  const out: RoofOut = { trim: [], solids: [] }
  const r = rng(b.seed ^ 0x2c1b3c6d)
  const [lo, hi] = COUNT[b.style]
  const n = lo + Math.floor(r() * (hi - lo + 1))
  for (let i = 0; i < n; i++) {
    const big = b.style === 'glass' && r() < 0.6
    const at = spot(r, w, d, core, big ? 2.6 : 1.5)
    if (at) acUnit(out, b, at[0], top, at[1], big)
  }
  if (b.style !== 'glass' && r() < 0.55) {
    const at = spot(r, w, d, core, 2.8)
    if (at) waterTank(out, b, at[0], top, at[1])
  }
  if (r() < 0.4) {
    const at = spot(r, w, d, core, 0.5)
    if (at) antenna(out, b, at[0], top, at[1], 4 + r() * 5)
  }
  return out
}
