import { at, stations, tangent, type P2 } from '../land/polyline'
import type { Face } from './layout'
import type { SideKind } from './faces'

/*
 * A face's curb broken into runs: each straight or gently curving stretch along one street
 * segment, between the rounded corners. Lamps, palms, furniture, and parking spaces are all
 * placed along runs, measured in meters from the run's start.
 */

export interface Run {
  pts: P2[]
  kind: SideKind
  /** Network segment beyond the run. */
  seg: number
  length: number
}

/** The face's curb runs (corners left out). */
export function runs(face: Pick<Face, 'curb' | 'sides' | 'segs'>): Run[] {
  const n = face.curb.length
  const out: Run[] = []
  // Start just after a corner so no run wraps past the ring's first point.
  const first = Math.max(
    0,
    face.segs.findIndex((s, i) => s >= 0 && face.segs[(i + n - 1) % n] < 0),
  )
  let cur: Run | null = null
  for (let k = 0; k < n; k++) {
    const i = (first + k) % n
    const seg = face.segs[i]
    if (seg < 0) {
      cur = null
      continue
    }
    if (!cur || cur.seg !== seg) {
      cur = { pts: [face.curb[i]], kind: face.sides[i], seg, length: 0 }
      out.push(cur)
    }
    cur.pts.push(face.curb[(i + 1) % n])
  }
  for (const r of out) r.length = stations(r.pts).at(-1)!
  return out
}

/** A point on a run: `along` meters from its start, `inward` meters into the face; `yaw` faces the street. */
export function onRun(run: Run, along: number, inward: number): P2 & { yaw: number } {
  const p = at(run.pts, along)
  const st = stations(run.pts)
  const i = Math.max(
    0,
    st.findIndex((s) => s >= along),
  )
  const t = tangent(run.pts, i)
  // The face lies left of travel (x right, z up): inward is (-tz, tx), outward its reverse.
  return {
    x: p.x - t.z * inward,
    z: p.z + t.x * inward,
    yaw: Math.atan2(t.z, -t.x),
  }
}

/** Evenly spaced points along a run, `inward` meters in, at least one, about `spacing` apart. */
export function spaced(run: Run, spacing: number, inward: number) {
  const n = Math.max(1, Math.floor(run.length / spacing))
  return Array.from({ length: n }, (_, k) => onRun(run, ((k + 0.5) * run.length) / n, inward))
}
