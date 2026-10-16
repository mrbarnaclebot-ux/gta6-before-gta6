import * as THREE from 'three'
import type { Path } from '../land/path'
import { at, stations, valueAt, type P3 } from '../land/polyline'
import { tinted } from '../world/blocks'
import { strip, sweep } from './sweep'

const WHITE = 0xe8e6df
const YELLOW = 0xd9a520
// Paint sits on the asphalt, which itself sits LIFT above the road's centerline height.
const PAINT = 0.065

type Line = [offset: number, width: number, color: number, dash?: [on: number, off: number]]

/** Lane paint per road kind, as offsets from the centerline (left positive). */
function linesFor(p: Path): Line[] {
  const hw = p.width / 2
  if (p.kind === 'highway') {
    return [-1, 1].flatMap((s): Line[] => [
      [s * 1.3, 0.15, YELLOW],
      [s * 4.9, 0.15, WHITE, [3, 9]],
      [s * 8.5, 0.2, WHITE],
    ])
  }
  if (p.kind === 'ramp') return [-1, 1].map((s): Line => [s * (hw - 0.5), 0.15, WHITE])
  if (p.kind === 'avenue' || p.kind === 'coast' || p.kind === 'hill') {
    return [
      [0.12, 0.1, YELLOW],
      [-0.12, 0.1, YELLOW],
      [hw - 0.6, 0.15, WHITE],
      [-(hw - 0.6), 0.15, WHITE],
    ]
  }
  return []
}

/** Short straight dashes along the line, `on` meters long with `off` between. */
function dashes(pts: P3[], on: number, off: number): P3[][] {
  const st = stations(pts)
  const y = pts.map((p) => p.y)
  const point = (s: number): P3 => ({ ...at(pts, s), y: valueAt(st, y, s) })
  const out: P3[][] = []
  for (let s = off / 2; s + on < st[st.length - 1]; s += on + off)
    out.push([point(s), point(s + on)])
  return out
}

/** Every road's lane paint outside the city, as vertex-colored strips. */
export function markingGeometry(paths: Path[]): THREE.BufferGeometry[] {
  return paths.flatMap((p) =>
    linesFor(p).flatMap(([offset, w, color, dash]) => {
      const parts = dash ? dashes(p.pts, ...dash) : [p.pts]
      return parts.map((pts) =>
        tinted(sweep(pts, strip(offset + w / 2, offset - w / 2, PAINT), p.closed && !dash), color),
      )
    }),
  )
}
