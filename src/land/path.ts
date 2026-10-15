import type { P2, P3 } from './polyline'

/** What a road is: the highway and its ramps, the surface streets, the dirt trail, a roundabout. */
export type Kind = 'highway' | 'ramp' | 'avenue' | 'street' | 'hill' | 'coast' | 'trail' | 'loop'

/** Full paved width in meters per kind. */
export const WIDTH: Record<Kind, number> = {
  highway: 22,
  ramp: 7,
  avenue: 14,
  street: 9,
  hill: 10,
  coast: 14,
  trail: 3.5,
  loop: 9,
}

/** A road outside the city grid: a centerline about every 4 m with its height. */
export interface Path {
  name: string
  kind: Kind
  width: number
  pts: P3[]
  /** A ring (roundabout): the last point joins the first. */
  closed?: boolean
}

export const lift = (pts: P2[], y: number[] | number): P3[] =>
  pts.map((p, i) => ({ x: p.x, y: typeof y === 'number' ? y : y[i], z: p.z }))

export const path = (name: string, kind: Kind, pts: P3[], closed = false): Path => ({
  name,
  kind,
  width: WIDTH[kind],
  pts,
  closed,
})
