import type { Grounded } from '../city/layout'
import { range, rng, type Rand } from '../city/rng'
import type { V3 } from './boids'

/*
 * Where sea life lives, as plain data: reef patches along the beach about 4 to 5 m deep,
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
  /** Where to start looking seaward (the beach's inland edge) and the stretch of coast. */
  x0: number
  z0: number
  z1: number
}

const REEF_GAP = 150
export const CORAL_KINDS = 4

/** The first x seaward of `x0` at row z where the water is at least `depth` deep. */
function seaward(b: Seabed, z: number, depth: number): number | null {
  for (let x = b.x0; x < b.x0 + 900; x += 2) if (b.depth(x, z) >= depth) return x
  return null
}

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

function reef(b: Seabed, r: Rand, z: number, plan: ReefPlan): void {
  const x = seaward(b, z, range(r, 3.8, 5.2))
  if (x === null) return
  const center = { x, y: b.floor(x, z), z }
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
  const meadow = seaward(b, z + range(r, -40, 40), range(r, 1.4, 2.4))
  if (meadow === null) return
  for (const g of scatter(b, r, { x: meadow, z }, [45, 55], 380, (d) => d > 0.9 && d < 4.5)) {
    // Tips stay well under the wave troughs.
    const room = (b.depth(g.x, g.z) - 0.5) * 0.6
    plan.grass.push({ ...g, s: Math.min(range(r, 0.3, 0.7), room), y: g.y + 0.02 })
  }
}

/** A cluster of rocks just off the waterline, tops above the surface. */
function surfRocks(b: Seabed, r: Rand, z: number, seaLevel: number, out: Grounded[]): void {
  const x = seaward(b, z, range(r, 0.5, 0.9))
  if (x === null) return
  for (let i = 0; i < 4; i++) {
    const rx = x + range(r, -3, 6)
    const rz = z + range(r, -5, 5)
    const y = b.floor(rx, rz) - 0.2
    // Tall enough to stand 0.4 to 1.2 m clear of the still water.
    out.push({ x: rx, z: rz, y, r: r() * Math.PI * 2, s: seaLevel - y + range(r, 0.4, 1.2) })
  }
}

export function planReefs(b: Seabed, seaLevel: number, seed = 11): ReefPlan {
  const r = rng(seed)
  const plan: ReefPlan = { reefs: [], grass: [], kelp: [], coral: [], rocks: [], surfRocks: [] }
  for (let z = b.z0 + 80; z < b.z1 - 80; z += REEF_GAP) {
    const at = z + range(r, -30, 30)
    reef(b, r, at, plan)
    if (r() < 0.45) surfRocks(b, r, at + REEF_GAP / 2, seaLevel, plan.surfRocks)
  }
  return plan
}
