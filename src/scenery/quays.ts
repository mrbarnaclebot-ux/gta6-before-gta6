import type { Rect } from '../city/layout'
import { CANAL_FLOOR } from '../land/waterways'
import type { Land } from '../land/plan'
import { addMerged, rectBox, rectCollider, type WorldCtx } from '../world/blocks'
import { pbr } from '../world/materials'

/*
 * Stone quays along the canal's channels outside the city: a wall on every edge of the
 * walled water that does not open onto more water (the city's canal, the branch, or the
 * dredged way out between the breakwaters). Each wall is more than a terrain cell wide, so
 * it covers the ground's slope down to the channel floor and its top meets the ground behind.
 */

const WIDE = 4.5
const TOP = 0.35
// Edges this close count as touching.
const TOUCH = 0.5

type Span = [number, number]

/** `span` with the parts covered by `cuts` taken out. */
function subtract(span: Span, cuts: Span[]): Span[] {
  let out: Span[] = [span]
  for (const [c0, c1] of cuts) {
    out = out.flatMap(([a, b]): Span[] => {
      if (c1 <= a || c0 >= b) return [[a, b]]
      return [
        [a, Math.max(a, c0)],
        [Math.min(b, c1), b],
      ].filter(([p, q]) => q - p > 0.5) as Span[]
    })
  }
  return out
}

/** Wall footprints for one rect of water: along each edge, outside it, where nothing `open` lies. */
function wallsOf(r: Rect, open: Rect[]): Rect[] {
  const others = open.filter((w) => w !== r)
  const out: Rect[] = []
  // Edges along x (north and south), then along z (west and east).
  for (const [z, dir] of [
    [r.z0, -1],
    [r.z1, 1],
  ]) {
    const beside = others.filter((w) => w.z0 - TOUCH <= z && w.z1 + TOUCH >= z)
    for (const [a, b] of subtract(
      [r.x0 - WIDE, r.x1 + WIDE],
      beside.map((w) => [w.x0, w.x1]),
    )) {
      out.push({ x0: a, x1: b, z0: Math.min(z, z + dir * WIDE), z1: Math.max(z, z + dir * WIDE) })
    }
  }
  for (const [x, dir] of [
    [r.x0, -1],
    [r.x1, 1],
  ]) {
    const beside = others.filter((w) => w.x0 - TOUCH <= x && w.x1 + TOUCH >= x)
    for (const [a, b] of subtract(
      [r.z0, r.z1],
      beside.map((w) => [w.z0, w.z1]),
    )) {
      out.push({ z0: a, z1: b, x0: Math.min(x, x + dir * WIDE), x1: Math.max(x, x + dir * WIDE) })
    }
  }
  return out
}

export function buildQuays(ctx: WorldCtx, land: Land): void {
  const { quays, dredged } = land.waterways.channels
  // The city's paved edge counts as open too: its own canal walls and walks meet the quays there.
  const open = [land.canal, land.land, ...quays, ...dredged]
  const walls = quays.flatMap((q) => wallsOf(q, open))
  const stone = pbr('white_stucco', 0.5, { color: 0xd4ccbc, roughness: 0.95 })
  addMerged(
    ctx,
    walls.map((w) => rectBox(w, CANAL_FLOOR - 0.2, TOP)),
    stone,
  )
  for (const w of walls) rectCollider(ctx, w, CANAL_FLOOR - 0.2, TOP)
}
