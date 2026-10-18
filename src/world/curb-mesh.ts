import type * as THREE from 'three'
import { CURB_H } from '../city/layout'
import type { SideKind } from '../city/faces'
import { slice } from '../city/network'
import type { Driveway } from '../city/parking-lots'
import type { Ring } from '../city/polygon'
import { closest, stations, type P2 } from '../land/polyline'
import { sweep, type Section } from '../scenery/sweep'

/*
 * The curb round a raised face: a concrete gutter pan on the road, a battered face, a
 * chamfered edge, and the 0.3 m top that meets the paving. Along the canal and the city's
 * edge there is no gutter. At a driveway the curb drops to a ramp (a curb cut).
 */

export const CURB_W = 0.3
/** Sections, left of travel positive (out toward the road, since faces are traced inside-left in x, z). */
const GUTTER: Section = [
  [0.45, 0.012],
  [0.05, 0.012],
  [0.02, 0.035],
  [0, CURB_H - 0.04],
  [-0.045, CURB_H],
  [-CURB_W, CURB_H],
]
const PLAIN: Section = GUTTER.slice(2)
const APRON: Section = [
  [0.45, 0.012],
  [0.05, 0.012],
  [-CURB_W, CURB_H],
]

const gutters = (k: SideKind) => k !== 'canal' && k !== 'edge'
const lift = (pts: P2[]) => pts.map((p) => ({ x: p.x, y: 0, z: p.z }))

/** Stretches of the ring with the same section, in travel order (the whole ring if all alike). */
function stretches(
  ring: Ring,
  sides?: SideKind[],
): { pts: P2[]; gutter: boolean; closed: boolean }[] {
  const n = ring.length
  const cls = (i: number) => !sides || gutters(sides[i])
  const first = Array.from({ length: n }, (_, i) => i).find((i) => cls(i) !== cls((i + n - 1) % n))
  if (first === undefined) return [{ pts: ring, gutter: cls(0), closed: true }]
  const out: { pts: P2[]; gutter: boolean; closed: boolean }[] = []
  for (let k = 0; k < n; k++) {
    const i = (first + k) % n
    const last = out[out.length - 1]
    if (!last || last.gutter !== cls(i)) out.push({ pts: [ring[i]], gutter: cls(i), closed: false })
    out[out.length - 1].pts.push(ring[(i + 1) % n])
  }
  return out
}

/** One open stretch swept, broken at the driveways that fall on it. */
function cut(pts: P2[], gutter: boolean, drives: Driveway[]): THREE.BufferGeometry[] {
  const len = stations(pts).at(-1)!
  const gaps = drives
    .map((d) => ({ d, c: closest(pts, d) }))
    .filter((g) => g.c.d < 0.5 && g.c.s > g.d.w / 2 && g.c.s < len - g.d.w / 2)
    .map((g) => [g.c.s - g.d.w / 2, g.c.s + g.d.w / 2])
    .sort((a, b) => a[0] - b[0])
  const out: THREE.BufferGeometry[] = []
  let from = 0
  for (const [a, b] of gaps) {
    if (a > from + 0.05) out.push(sweep(lift(slice(pts, from, a)), gutter ? GUTTER : PLAIN))
    out.push(sweep(lift(slice(pts, a, b)), APRON))
    from = b
  }
  if (len > from + 0.05) out.push(sweep(lift(slice(pts, from, len)), gutter ? GUTTER : PLAIN))
  return out
}

/** The curb round a ring: the gutter where it meets a street, curb cuts at the driveways. */
export function curbGeometry(
  ring: Ring,
  sides: SideKind[] | undefined,
  drives: Driveway[],
): THREE.BufferGeometry[] {
  return stretches(ring, sides).flatMap((s) =>
    s.closed && !drives.length
      ? [sweep(lift(s.pts), s.gutter ? GUTTER : PLAIN, true)]
      : cut(s.closed ? [...s.pts, s.pts[0]] : s.pts, s.gutter, drives),
  )
}
