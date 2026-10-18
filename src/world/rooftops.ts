import * as THREE from 'three'
import type { Grounded } from '../city/layout'
import type { Building, Style } from '../city/lots'
import { rng, type Rand } from '../city/rng'
import { metricBox, tinted } from './blocks'

/*
 * Rooftop clutter: AC units, water tanks on stands, and antennas. Plain stand-ins for the
 * units and tanks are merged into each chunk's trim mesh (no extra draw calls, and they cast
 * the shadows); the Blender models drawn over them near the camera (roof-props.ts) hide
 * them. Every roof keeps its north-west corner clear, where the rooftop landmark stands the
 * player (city.ts), and the stair or machine core in its middle.
 */

const DARK = 0x5d6266
const STEEL = 0xc9cac6
const WOOD = 0x6b5440
/** The Blender AC unit is 0.9 m square and 0.79 m tall; the water tank 2.1 m across and 4.5 m tall. */
const AC = { w: 0.9, h: 0.79 }
const TANK = { w: 2.15, h: 4.5 }
/** The north-west corner kept clear, in meters from each wall. */
const CLEAR = 6

/** An AC unit or water tank: where it stands, its quarter turn, and its scale. */
export type RoofProp = Grounded & { kind: 'ac' | 'tank' }

/** What goes onto roofs: the trim geometry, the models, and the solid boxes the player stands against. */
export interface RoofOut {
  trim: THREE.BufferGeometry[]
  props: RoofProp[]
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

/** Just inside the model's cabinet or barrel, so the model hides it wherever it is drawn. */
function standIn(kind: RoofProp['kind']): THREE.BufferGeometry {
  if (kind === 'ac') return tinted(metricBox(0.76, 0.66, 0.76).translate(0, 0.33, 0), STEEL)
  return tinted(new THREE.CylinderGeometry(0.96, 0.96, 2.3, 8).translate(0, 2.7, 0), WOOD)
}

/** A model at (x, z) on the roof at height y, `s` times its size, with its collider box. */
function prop(
  out: RoofOut,
  b: Building,
  kind: RoofProp['kind'],
  x: number,
  y: number,
  z: number,
  s: number,
) {
  const { w, h } = kind === 'ac' ? AC : TANK
  const at = { x: b.x + x, z: b.z + z }
  // A quarter turn from the spot itself, so placing one draws nothing from the building's dice.
  const r = (Math.abs(Math.round(at.x * 3 + at.z * 7)) % 4) * (Math.PI / 2)
  out.props.push({ kind, ...at, y, s, r })
  out.trim.push(standIn(kind).scale(s, s, s).translate(at.x, y, at.z))
  const half = (w * s) / 2
  const min = new THREE.Vector3(at.x - half, y, at.z - half)
  out.solids.push(new THREE.Box3(min, new THREE.Vector3(at.x + half, y + h * s, at.z + half)))
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
  const out: RoofOut = { trim: [], props: [], solids: [] }
  const r = rng(b.seed ^ 0x2c1b3c6d)
  const [lo, hi] = COUNT[b.style]
  const n = lo + Math.floor(r() * (hi - lo + 1))
  for (let i = 0; i < n; i++) {
    const big = b.style === 'glass' && r() < 0.6
    const at = spot(r, w, d, core, big ? 2.6 : 1.5)
    // Big commercial units on the glass towers, house-sized ones elsewhere.
    if (at) prop(out, b, 'ac', at[0], top, at[1], big ? 2.6 : 1.25)
  }
  if (b.style !== 'glass' && r() < 0.55) {
    const at = spot(r, w, d, core, 2.8)
    if (at) prop(out, b, 'tank', at[0], top, at[1], 1.1)
  }
  if (r() < 0.4) {
    const at = spot(r, w, d, core, 0.5)
    if (at) antenna(out, b, at[0], top, at[1], 4 + r() * 5)
  }
  return out
}
