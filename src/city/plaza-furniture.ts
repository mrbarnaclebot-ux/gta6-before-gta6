import type { Furniture } from './furniture'
import { FOUNTAIN, PLANTER, plazaFountain, plazaTrees } from './greenery'
import { CURB_H, type CityLayout } from './layout'
import { area, centroid, contains, insetRing, type Ring } from './polygon'

/*
 * Somewhere to sit in the plazas: a bench on the inner side of every other palm planter
 * and four round the fountain, each facing into the plaza with a bin beside some, and a
 * kiosk in the middle of the bigger plazas without a fountain. Pure data, like furniture.ts.
 */

/** Plazas at least this big get a kiosk in the middle, if it is clear. */
const KIOSK_AREA = 300
/** Meters kept between a bench or kiosk and any planter or the fountain's rim. */
const GAP = 1.2

type P = { x: number; z: number }

/** Facing from `p` toward `to`: the item's front (+z) points that way. */
const facing = (p: P, to: P) => Math.atan2(to.x - p.x, to.z - p.z)

function seats(plaza: Ring, trees: P[], fountain: P | null): Furniture[] {
  const mid = centroid(plaza)
  const inner = insetRing(plaza, 1.2)
  const clear = (p: P, keep: P) =>
    contains(inner, p) &&
    trees.every((t) => t === keep || Math.hypot(t.x - p.x, t.z - p.z) > PLANTER.r + GAP) &&
    (!fountain || Math.hypot(fountain.x - p.x, fountain.z - p.z) > FOUNTAIN.r + 1.5)
  const out: Furniture[] = []
  let benches = 0
  const bench = (p: P, look: P, keep: P) => {
    if (!clear(p, keep)) return
    const r = facing(p, look)
    out.push({ kind: 'bench', x: p.x, y: CURB_H, z: p.z, r, v: 0 })
    // A bin at the bench's right hand on every other one.
    const bin = { x: p.x - Math.cos(r) * 1.4, z: p.z + Math.sin(r) * 1.4 }
    if (benches++ % 2 === 0 && clear(bin, keep))
      out.push({ kind: 'bin', ...bin, y: CURB_H, r, v: 0 })
  }
  trees.forEach((t, k) => {
    const d = Math.hypot(mid.x - t.x, mid.z - t.z)
    if (k % 2 || d < 1) return
    const reach = PLANTER.r + 0.75
    bench({ x: t.x + ((mid.x - t.x) / d) * reach, z: t.z + ((mid.z - t.z) / d) * reach }, mid, t)
  })
  if (fountain)
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4
      const p = { x: fountain.x + Math.cos(a) * 6.6, z: fountain.z + Math.sin(a) * 6.6 }
      bench(p, fountain, fountain)
    }
  return out
}

/** Benches, bins, and kiosks in every plaza off the beachfront (the hotels' decks have loungers). */
export function plazaFurniture(c: CityLayout): Furniture[] {
  const out: Furniture[] = []
  for (const b of c.blocks) {
    if (b.district === 'beachfront') continue
    for (const plaza of b.plazas) {
      const trees = plazaTrees(plaza)
      const fountain = plazaFountain(plaza)
      out.push(...seats(plaza, trees, fountain))
      const mid = centroid(plaza)
      const open = trees.every((t) => Math.hypot(t.x - mid.x, t.z - mid.z) > PLANTER.r + 3)
      if (!fountain && area(plaza) > KIOSK_AREA && open && contains(insetRing(plaza, 3), mid)) {
        const r = (Math.round(mid.x + mid.z) % 4) * (Math.PI / 2)
        out.push({ kind: 'kiosk', x: mid.x, y: CURB_H, z: mid.z, r, v: 0 })
      }
    }
  }
  return out
}
