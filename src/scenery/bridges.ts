import * as THREE from 'three'
import { heightAt } from '../city/terrain'
import type { Land } from '../land/plan'
import type { Path } from '../land/path'
import { closest, tangent, type P3 } from '../land/polyline'
import { RAPIER } from '../physics'
import type { WorldCtx } from '../world/blocks'
import { runs, sweep, type Section } from './sweep'

/** Road surfaces sit this far above their centerline height, clear of the cut ground under them. */
export const LIFT = 0.05
const DECK = 1.3
const PARAPET = 1.0
// Piers stand where the deck is this high, every PIER_GAP meters, clear of the road beneath.
const PIER_FROM = 3
const PIER_GAP = 24
const PIER = 1.4

const box = (aL: number, aR: number, b0: number, b1: number): Section => [
  [aL, b1],
  [aR, b1],
  [aR, b0],
  [aL, b0],
  [aL, b1],
]

/** Jersey barrier down the median: wide foot, narrow top. */
const JERSEY: Section = [
  [0.3, LIFT],
  [0.24, 0.35],
  [0.1, 0.9],
  [-0.1, 0.9],
  [-0.24, 0.35],
  [-0.3, LIFT],
]

const lift = (land: Land, p: P3) => p.y - heightAt(land, p.x, p.z)

/** Static triangle-mesh collider matching a geometry exactly. */
export function trimeshCollider(ctx: WorldCtx, geo: THREE.BufferGeometry): void {
  const pos = geo.attributes.position.array as Float32Array
  const idx = new Uint32Array(geo.index!.array)
  ctx.physics.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(pos), idx))
}

/** Two piers and a cap beam under the deck at point i. */
function pier(p: Path, i: number, ground: number): THREE.BufferGeometry[] {
  const c = p.pts[i]
  const t = tangent(p.pts, i)
  const yaw = Math.atan2(t.x, t.z)
  const top = c.y - DECK
  const half = p.width / 2
  const posts = [-1, 1].map((s) =>
    new THREE.BoxGeometry(PIER, top - ground + 1, PIER).translate(
      s * half * 0.55,
      (top + ground - 1) / 2,
      0,
    ),
  )
  const cap = new THREE.BoxGeometry(p.width * 0.85, 1.1, PIER * 1.2).translate(0, top - 0.55, 0)
  return [...posts, cap].map((g) => g.rotateY(yaw).translate(c.x, 0, c.z))
}

/**
 * Concrete for the highway and its ramps: decks with parapets where the road leaves the
 * ground, piers under them, and the median barrier. Everything a car can hit collides.
 */
export function bridgeGeometry(
  ctx: WorldCtx,
  land: Land,
  roads: Path[],
  under: Path[],
): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = []
  for (const p of roads) {
    const hw = p.width / 2
    for (const run of runs(p.pts, (q) => lift(land, q) > 0.9)) {
      const parapets = [box(hw, hw - 0.4, LIFT, PARAPET), box(-hw + 0.4, -hw, LIFT, PARAPET)].map(
        (s) => sweep(run, s),
      )
      // The deck's sides and underside; the asphalt sweep is its top.
      out.push(sweep(run, box(hw, -hw, -DECK, LIFT).slice(1)), ...parapets)
      parapets.forEach((g) => trimeshCollider(ctx, g))
    }
    p.pts.forEach((q, i) => {
      if (i % (PIER_GAP / 4) || lift(land, q) < PIER_FROM + DECK) return
      if (under.some((u) => closest(u.pts, q).d < u.width / 2 + 3)) return
      const geos = pier(p, i, heightAt(land, q.x, q.z))
      out.push(...geos)
      geos.forEach((g) => trimeshCollider(ctx, g))
    })
    if (p.kind === 'highway') {
      const barrier = sweep(p.pts, JERSEY)
      out.push(barrier)
      trimeshCollider(ctx, barrier)
    }
  }
  return out
}
