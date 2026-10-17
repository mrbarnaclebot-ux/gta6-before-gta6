import type { Grounded } from '../city/layout'
import { range, rng, type Rand } from '../city/rng'
import type { Shore } from '../land/beach-props'
import type { V3 } from './boids'

/*
 * Where sea life lives, as plain data: reef patches off the beaches about 4 to 5 m deep,
 * seagrass meadows in the shallows inshore of them, and a few rocks breaking the surface
 * near the waterline. Seeded, so the sea floor is the same every load.
 */

export interface Coral extends Grounded {
  kind: number
}

export interface ReefPlan {
  reefs: V3[]
  grass: Grounded[]
  kelp: Grounded[]
  coral: Coral[]
  rocks: Grounded[]
  /** Rocks whose tops stand above the surface: they collide and the surf foams around them. */
  surfRocks: Grounded[]
}

export interface Seabed {
  /** Water depth at rest, negative on land. */
  depth: (x: number, z: number) => number
  floor: (x: number, z: number) => number
  /** Where to start looking seaward from, about REEF_GAP apart along the beaches. */
  shore: Shore[]
}

export const REEF_GAP = 160
export const CORAL_KINDS = 4

/** The first point out from the shore point `s` where the water is at least `depth` deep. */
function seaward(b: Seabed, s: Shore, depth: number): { x: number; z: number } | null {
  for (let d = 0; d < 900; d += 2) {
    const p = { x: s.x + s.nx * d, z: s.z + s.nz * d }
    if (b.depth(p.x, p.z) >= depth) return p
  }
  return null
}

/** The shore point `along` meters to the side. */
const beside = (s: Shore, along: number): Shore => ({
  ...s,
  x: s.x - s.nz * along,
  z: s.z + s.nx * along,
})

/** `n` spots scattered in an ellipse around (x, z), kept where the depth suits. */
function scatter(
  b: Seabed,
  r: Rand,
  at: { x: number; z: number },
  size: [number, number],
  n: number,
  ok: (d: number) => boolean,
) {
  const out: Grounded[] = []
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r())
    const x = at.x + Math.cos(a) * d * size[0]
    const z = at.z + Math.sin(a) * d * size[1]
    if (!ok(b.depth(x, z))) continue
    out.push({ x, z, y: b.floor(x, z) - 0.05, r: r() * Math.PI * 2, s: 1 })
  }
  return out
}

function reef(b: Seabed, r: Rand, s: Shore, plan: ReefPlan): void {
  const at = seaward(b, s, range(r, 3.8, 5.2))
  if (at === null) return
  const center = { x: at.x, y: b.floor(at.x, at.z), z: at.z }
  plan.reefs.push(center)
  const deep = (d: number) => d > 2.2
  for (const c of scatter(b, r, center, [20, 15], 48, deep)) {
    plan.coral.push({ ...c, s: range(r, 0.35, 1.3), kind: Math.floor(r() * CORAL_KINDS) })
  }
  for (const k of scatter(b, r, center, [24, 18], 26, (d) => d > 3)) {
    const room = b.depth(k.x, k.z) - 1.2
    plan.kelp.push({ ...k, s: range(r, room * 0.6, Math.min(4.5, room)) })
  }
  for (const s of scatter(b, r, center, [22, 16], 12, deep))
    plan.rocks.push({ ...s, s: range(r, 0.6, 1.8) })
  const meadow = seaward(b, beside(s, range(r, -40, 40)), range(r, 1.4, 2.4))
  if (meadow === null) return
  for (const g of scatter(b, r, meadow, [45, 55], 380, (d) => d > 0.9 && d < 4.5)) {
    // Tips stay well under the wave troughs.
    const room = (b.depth(g.x, g.z) - 0.5) * 0.6
    plan.grass.push({ ...g, s: Math.min(range(r, 0.3, 0.7), room), y: g.y + 0.02 })
  }
}

/** A cluster of rocks just off the waterline, tops above the surface. */
function surfRocks(b: Seabed, r: Rand, s: Shore, seaLevel: number, out: Grounded[]): void {
  const at = seaward(b, s, range(r, 0.5, 0.9))
  if (at === null) return
  for (let i = 0; i < 4; i++) {
    const rx = at.x + range(r, -4, 4)
    const rz = at.z + range(r, -4, 4)
    const y = b.floor(rx, rz) - 0.2
    // Tall enough to stand 0.4 to 1.2 m clear of the still water.
    out.push({ x: rx, z: rz, y, r: r() * Math.PI * 2, s: seaLevel - y + range(r, 0.4, 1.2) })
  }
}

export function planReefs(b: Seabed, seaLevel: number, seed = 11): ReefPlan {
  const r = rng(seed)
  const plan: ReefPlan = { reefs: [], grass: [], kelp: [], coral: [], rocks: [], surfRocks: [] }
  for (const s of b.shore) {
    reef(b, r, beside(s, range(r, -30, 30)), plan)
    if (r() < 0.45) surfRocks(b, r, beside(s, REEF_GAP / 2), seaLevel, plan.surfRocks)
  }
  return plan
}
