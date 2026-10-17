import { CELL, type HeightGrid } from './grid'
import { fbm, smoothstep } from './noise'
import { edgePiles, type MarinaPlan } from './marina-plan'
import type { P2 } from './polyline'

/*
 * The forest lake: a hollow on the east flank of the west hill with its own still water
 * surface well above the sea. The ground around it is eased level with its shore before
 * roads are laid, and the basin is dug after, so the trail runs flat along the bank.
 */

export interface Lake {
  x: number
  z: number
  /** Water surface height. */
  level: number
  /** Mean shore radius; the shore wanders around it. */
  r: number
}

export const LAKE: Lake = { x: -1420, z: -128, level: 17, r: 64 }
/** The banks stand this far above the water, easing back to the natural ground over SURROUND meters. */
const RIM = 1.1
const SURROUND = 150
const DEPTH = 5.5

/** Shore radius toward angle `a`. */
export function shoreRadius(l: Lake, a: number): number {
  return l.r * (1 + 0.2 * fbm(Math.cos(a) * 1.3 + 4, Math.sin(a) * 1.3 + 4, 57, 3))
}

/** The shore as a closed ring of points. */
export function lakeShore(l: Lake, step = 4): P2[] {
  const n = Math.ceil((2 * Math.PI * l.r) / step)
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const r = shoreRadius(l, a)
    return { x: l.x + Math.cos(a) * r, z: l.z + Math.sin(a) * r }
  })
}

/** Meters outside the shore at (x, z): negative over the water. */
export function pastShore(l: Lake, x: number, z: number): number {
  const r = Math.hypot(x - l.x, z - l.z)
  // The shore never strays past 1.4 radii: far away the exact distance does not matter.
  if (r > l.r * 1.4 + 200) return r - l.r
  return r - shoreRadius(l, Math.atan2(z - l.z, x - l.x))
}

/** Natural ground `h` eased toward the lake's rim height around it. */
export function lakeHollow(l: Lake, x: number, z: number, h: number): number {
  const d = pastShore(l, x, z)
  if (d > SURROUND) return h
  return l.level + RIM + (h - l.level - RIM) * smoothstep(0, SURROUND, d)
}

/** Digs the basin: a shelving shore, then a bowl. */
export function carveLake(g: HeightGrid, l: Lake): void {
  const reach = l.r * 1.4
  const i0 = Math.max(0, Math.floor((l.x - reach - g.x0) / CELL))
  const j0 = Math.max(0, Math.floor((l.z - reach - g.z0) / CELL))
  const n = Math.ceil((2 * reach) / CELL)
  for (let i = i0; i <= Math.min(g.nx, i0 + n); i++) {
    for (let j = j0; j <= Math.min(g.nz, j0 + n); j++) {
      const d = pastShore(l, g.x0 + i * CELL, g.z0 + j * CELL)
      if (d > 6) continue
      // Up to 6 m past the shore the bank slopes down to the waterline, then shelves to the bowl.
      const bank = l.level + RIM * smoothstep(-1, 6, d)
      const bowl = l.level - DEPTH * smoothstep(0, l.r * 0.7, -d)
      const k = i * (g.nz + 1) + j
      g.h[k] = Math.min(g.h[k], d > 0 ? bank : Math.min(bank, bowl - 0.25))
    }
  }
}

/** The lake's surface height at (x, z), or null off it. */
export function lakeSurfaceAt(l: Lake, x: number, z: number): number | null {
  return pastShore(l, x, z) < 0.5 ? l.level : null
}

/** The jetty off the lake's east shore, where the trail passes: planks on piles, a lamp at the end. */
export function lakeJetty(l: Lake): MarinaPlan {
  const shore = l.x + shoreRadius(l, 0)
  const deckY = l.level + 0.45
  const deck = { x0: shore - 24, x1: shore + 4, z0: l.z - 1.3, z1: l.z + 1.3 }
  const pool = { ...deck, x1: deck.x0 + 5 }
  return {
    decks: [deck],
    deckY,
    piles: edgePiles(deck, 'x'),
    bollards: [],
    lamps: [{ x: deck.x0 + 1, z: deck.z1 - 0.2, pool }],
    boats: [],
    dock: { x: deck.x0 + 1.5, y: deckY, z: l.z },
    zone: deck,
  }
}
