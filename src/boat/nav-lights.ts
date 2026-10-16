import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Boat space (+x port, +z bow): a bicolor lamp on the bow tip (red to port, green to
 * starboard) and an all-round white lamp on a short stern pole. Radius, then position.
 */
const LAMPS: [number, number, number, number, number][] = [
  [0.045, 0.06, 0.95, 3.12, 0xff2010],
  [0.045, -0.06, 0.95, 3.12, 0x10ff40],
  [0.04, 0, 1.5, -2.3, 0xb0a898],
]
const POLE = { y0: 1.05, y1: 1.47, z: -2.3, color: 0x0a0a0a }

// Unlit and over 1 at night so the bloom picks the lamps out; one material for every boat.
const glow = new THREE.MeshBasicMaterial({ vertexColors: true })
let geometry: THREE.BufferGeometry | null = null

/** The navigation lamps and the stern pole as one mesh (one draw call per boat). */
export function navLights(): THREE.Mesh {
  geometry ??= mergeGeometries([...LAMPS.map(lamp), pole()])
  const mesh = new THREE.Mesh(geometry, glow)
  mesh.castShadow = mesh.receiveShadow = false
  return mesh
}

/** 0 by day, 1 at night: the lenses are dim colored glass by day. */
export function setNavNight(night: number): void {
  glow.color.setScalar(0.25 + 5 * night)
}

function lamp([r, x, y, z, hex]: (typeof LAMPS)[number]): THREE.BufferGeometry {
  return paint(new THREE.SphereGeometry(r, 10, 6).translate(x, y, z), hex)
}

function pole(): THREE.BufferGeometry {
  const { y0, y1, z, color } = POLE
  const g = new THREE.CylinderGeometry(0.012, 0.012, y1 - y0, 6).translate(0, (y0 + y1) / 2, z)
  return paint(g, color)
}

function paint(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex)
  const n = g.getAttribute('position').count
  g.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(new Array(n).fill([c.r, c.g, c.b]).flat(), 3),
  )
  return g
}
