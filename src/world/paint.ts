import * as THREE from 'three'
import { roadRise, type Bridge } from '../city/canal-bridge'
import type { Rect } from '../city/layout'
import { at, type P2 } from '../land/polyline'

/*
 * Road paint drawn in a street's own frame: u meters along its centerline, v meters to the
 * driver's right. Bands (lines, bars) and glyphs (arrows) collect into one vertex-colored
 * geometry that sits a few millimeters over the road, humps included.
 */

/** Paint stands this far above the road surface. */
const PAINT = 0.004

type City = { canal: Rect; bridges: Bridge[] }

/** A frame at station u: the point, the way along, and the driver's right. */
function frame(line: P2[], u: number) {
  const a = at(line, u - 0.5)
  const b = at(line, u + 0.5)
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const t = { x: (b.x - a.x) / l, z: (b.z - a.z) / l }
  return { p: at(line, u), t, r: { x: -t.z, z: t.x } }
}

export class Paint {
  private readonly pos: number[] = []
  private readonly col: number[] = []
  private readonly idx: number[] = []
  /** Height of the surface painted on, over the road's (the parking lots stand at the curb's height). */
  base = 0

  constructor(private readonly city: City) {}

  /** The world point at (u, v) in the line's frame, on the road. */
  private point(line: P2[], u: number, v: number): [number, number, number] {
    const f = frame(line, u)
    const x = f.p.x + f.r.x * v
    const z = f.p.z + f.r.z * v
    return [x, roadRise(this.city, x, z) + this.base + PAINT, z]
  }

  /** A triangle, wound to face up. */
  private tri(a: number[], b: number[], c: number[], color: THREE.Color): void {
    const cross = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])
    const o = this.pos.length / 3
    for (const p of cross > 0 ? [a, c, b] : [a, b, c]) {
      this.pos.push(p[0], p[1], p[2])
      this.col.push(color.r, color.g, color.b)
    }
    this.idx.push(o, o + 1, o + 2)
  }

  /** A band from u0 to u1 along the line, between v0 and v1, sampled every `step` meters. */
  band(
    line: P2[],
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    color: THREE.Color,
    step = 4,
  ): void {
    if (u1 - u0 < 0.05) return
    const n = Math.max(1, Math.ceil((u1 - u0) / step))
    let prev: number[][] | null = null
    for (let k = 0; k <= n; k++) {
      const u = u0 + ((u1 - u0) * k) / n
      const cur = [this.point(line, u, v0), this.point(line, u, v1)]
      if (prev) {
        this.tri(prev[0], prev[1], cur[1], color)
        this.tri(prev[0], cur[1], cur[0], color)
      }
      prev = cur
    }
  }

  /** Dashes along the line: `on` meters painted, `off` meters bare. */
  dashes(
    line: P2[],
    u0: number,
    u1: number,
    v: number,
    w: number,
    on: number,
    off: number,
    color: THREE.Color,
  ) {
    for (let u = u0 + off / 2; u + on <= u1; u += on + off)
      this.band(line, u, u + on, v - w / 2, v + w / 2, color)
  }

  /** A glyph of triangles given in (du, dv) about station u, offset v. */
  glyph(line: P2[], u: number, v: number, tris: [number, number][][], color: THREE.Color): void {
    for (const t of tris) {
      const [a, b, c] = t.map(([du, dv]) => this.point(line, u + du, v + dv))
      this.tri(a, b, c, color)
    }
  }

  geometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    geo.setIndex(this.idx)
    geo.computeVertexNormals()
    return geo
  }
}

const quad = (u0: number, u1: number, v0: number, v1: number): [number, number][][] => [
  [
    [u0, v0],
    [u1, v0],
    [u1, v1],
  ],
  [
    [u0, v0],
    [u1, v1],
    [u0, v1],
  ],
]

/** A straight-ahead arrow, pointing +u, 5 m long. */
export const AHEAD: [number, number][][] = [
  ...quad(-2.5, 0.8, -0.08, 0.08),
  [
    [0.8, -0.32],
    [2.5, 0],
    [0.8, 0.32],
  ],
]

/** A left-turn arrow (to the driver's left, -v), 5 m long. */
export const LEFT: [number, number][][] = [
  ...quad(-2.5, 0.6, -0.08, 0.08),
  ...quad(0.6, 0.76, -0.9, 0.08),
  [
    [0.36, -0.9],
    [1.0, -0.9],
    [0.68, -1.6],
  ],
]
