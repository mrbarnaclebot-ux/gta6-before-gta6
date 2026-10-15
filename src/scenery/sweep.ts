import * as THREE from 'three'
import { stations, tangent, type P3 } from '../land/polyline'

/** A cross-section point: `a` meters to the left of the centerline, `b` meters above it. */
export type Section = [a: number, b: number][]

/**
 * Sweeps a cross-section along a 3D centerline: road surfaces, curbs, barriers, and
 * bridge decks are all this. UVs are in meters: u around the section, v along the line.
 * A section runs left to right over the top, then down the right side: faces point
 * outward when, seen from behind, the section turns clockwise (a box: right side down,
 * under, left side up).
 */
export function sweep(pts: P3[], section: Section, closed = false): THREE.BufferGeometry {
  const line = closed ? [...pts, pts[0]] : pts
  const st = stations(line)
  const around = [0]
  for (let k = 1; k < section.length; k++) {
    around.push(
      around[k - 1] +
        Math.hypot(section[k][0] - section[k - 1][0], section[k][1] - section[k - 1][1]),
    )
  }
  const pos: number[] = []
  const uv: number[] = []
  line.forEach((p, i) => {
    const t = tangent(line, closed && i === line.length - 1 ? 0 : i)
    for (let k = 0; k < section.length; k++) {
      const [a, b] = section[k]
      // Left of travel is (t.z, -t.x) with yaw 0 facing +z.
      pos.push(p.x + t.z * a, p.y + b, p.z - t.x * a)
      uv.push(around[k], st[i])
    }
  })
  const n = section.length
  const idx: number[] = []
  for (let i = 0; i + 1 < line.length; i++) {
    for (let k = 0; k + 1 < n; k++) {
      const a = i * n + k
      const b = a + n
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** Flat strip from `left` to `right` meters (left positive), `lift` above the line. */
export const strip = (left: number, right: number, lift = 0): Section => [
  [left, lift],
  [right, lift],
]

/** Index runs of consecutive points where `keep` holds, at least two points long. */
export function runs<T>(pts: T[], keep: (p: T, i: number) => boolean): T[][] {
  const out: T[][] = []
  let cur: T[] = []
  pts.forEach((p, i) => {
    if (keep(p, i)) cur.push(p)
    else {
      if (cur.length > 1) out.push(cur)
      cur = []
    }
  })
  if (cur.length > 1) out.push(cur)
  return out
}
