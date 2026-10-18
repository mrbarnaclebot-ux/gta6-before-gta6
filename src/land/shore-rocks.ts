import { SEA_LEVEL, type Grounded, type Rect } from '../city/layout'
import { range, rng, type Rand } from '../city/rng'
import { BLOCKED, clearAt, type Clearance } from './clearance'
import { shoreline, type Shore } from './coast'
import { lie, upAt, type Surface } from './footing'
import type { Land } from './plan'
import { ROCK_RIM, ROCK_SPREAD, SINK, tint } from './plant'
import { fbm, smoothstep } from './noise'
import { wildness } from './shape'

/*
 * Rocks the sea has put to work: the canal's breakwaters, groynes across the wild beaches,
 * heaps of stones and fallen boulders along every rocky shore, bedrock in the cliff faces,
 * outcrops where beach meets rock, and stones on the river's banks. All are the forest's
 * moss rocks, tinted paler.
 */

const GROYNE = { gap: 260, from: 26, to: 112 }
/** Big boulders and bedrock sit this share of their size into the ground: the deepest any rock is set. */
export const BEDROCK_SINK = 0.3

/** Sun-bleached and salt-washed: a quarter of the way from a tint to white. */
const pale = (c: number) =>
  [16, 8, 0].reduce((out, sh) => {
    const v = (c >> sh) & 255
    return out | (Math.round(v + (255 - v) * 0.25) << sh)
  }, 0)

type Put = (x: number, z: number, s: number, sink?: number) => void

/** Meters out from the coast line to where the ground falls below the waterline. */
function waterline(p: Shore, ground: Surface): number {
  let d = 0
  while (d < 60 && ground(p.x + p.nx * d, p.z + p.nz * d) > SEA_LEVEL + 0.4) d += 1
  return d
}

/** Mostly small stones, some larger, a rare big one: sizes fall off the way scree does. */
const stoneSize = (r: Rand) => 0.45 + 2.1 * r() ** 2.4

/**
 * Rocks along every rocky shore, heaped by noise along the line: piles with bare gaps between,
 * stones scattered up and down the beach line, and big boulders fallen to the cliff's foot.
 */
function riprap(shore: Shore[], ground: Surface, put: Put, r: Rand) {
  let next = 0
  for (const p of shore) {
    if (p.sand > 0.3 || p.s < next) continue
    next = p.s + range(r, 1.4, 2.6)
    const heap = fbm(p.s / 38, 0.5, 23, 3)
    if (heap < -0.2 && r() > 0.12) continue
    const d = waterline(p, ground)
    const n = heap < -0.2 ? 1 : 1 + Math.floor(5 * smoothstep(-0.2, 0.5, heap) * r())
    for (let k = 0; k < n; k++) {
      const s = stoneSize(r)
      // Big stones lie at the foot of the cliff; small ones are rolled out into the shallows.
      const dd = d + (s > 1.6 ? range(r, -3.5, 0.5) : range(r, -2.5, 5))
      const side = range(r, -1.6, 1.6)
      put(p.x + p.nx * dd - p.nz * side, p.z + p.nz * dd + p.nx * side, s)
    }
    // Big boulders: fallen to the cliff's foot, or out in the shallows, half drowned.
    if (heap > 0.2 && r() < 0.14) {
      const dd = d + (r() < 0.6 ? -range(r, 2, 5) : range(r, 3, 12))
      put(p.x + p.nx * dd, p.z + p.nz * dd, range(r, 2.6, 4.6), BEDROCK_SINK)
    }
  }
}

/** Bedrock breaking through the cliff face in clumps: big rocks sunk deep into the slope. */
function outcrops(shore: Shore[], ground: Surface, put: Put, r: Rand) {
  let next = 0
  for (const p of shore) {
    if (p.sand > 0.2 || p.s < next) continue
    next = p.s + range(r, 9, 26)
    if (fbm(p.s / 70, 3.5, 29, 2) < -0.25) continue
    const d = waterline(p, ground)
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
      const dd = d * range(r, 0.15, 0.75)
      const side = range(r, -4, 4)
      put(
        p.x + p.nx * dd - p.nz * side,
        p.z + p.nz * dd + p.nx * side,
        range(r, 2.2, 4.5),
        BEDROCK_SINK,
      )
    }
  }
}

/** Lines of boulders down wild beaches into the surf, and outcrops where sand meets rock. */
function groynes(land: Land, shore: Shore[], put: Put, r: Rand) {
  let next = GROYNE.gap / 2
  for (const p of shore) {
    if (p.s < next) continue
    const edge = p.sand > 0.35 && p.sand < 0.7
    if (edge) {
      next = p.s + 90
      for (let k = 0; k < 9; k++) {
        const d = range(r, 6, 60)
        const side = range(r, -12, 12)
        put(p.x + p.nx * d - p.nz * side, p.z + p.nz * d + p.nx * side, range(r, 0.6, 2.4))
      }
    }
    if (p.sand < 0.95 || wildness(land.frame, p.x, p.z) < 0.4) continue
    next = p.s + GROYNE.gap
    for (let d = GROYNE.from; d < GROYNE.to; d += 1.7) {
      for (const side of [-1.1, 1.1]) {
        const w = side + range(r, -0.4, 0.4)
        const x = p.x + p.nx * d - p.nz * w
        put(x, p.z + p.nz * d + p.nx * w, range(r, 0.8, 1.6) * (d < 45 ? 0.75 : 1))
      }
    }
  }
}

/** The breakwaters off the canal's mouths: three rows of big rubble along each. */
function moles(moles: Rect[], put: Put, r: Rand) {
  for (const m of moles) {
    const alongZ = m.z1 - m.z0 > m.x1 - m.x0
    const [a0, a1] = alongZ ? [m.z0, m.z1] : [m.x0, m.x1]
    const mid = alongZ ? (m.x0 + m.x1) / 2 : (m.z0 + m.z1) / 2
    for (let a = a0 + 1; a < a1; a += 1.9) {
      for (const off of [-2.6, 0, 2.6]) {
        const across = mid + off + range(r, -0.5, 0.5)
        const along = a + range(r, -0.5, 0.5)
        const s = (off === 0 ? 1.4 : 1) * range(r, 1.1, 1.8)
        if (alongZ) put(across, along, s)
        else put(along, across, s)
      }
    }
  }
}

/** Stones along both banks of the river. */
function riverStones(land: Land, put: Put, r: Rand) {
  const river = land.waterways.river
  for (let i = 4; i + 1 < river.pts.length; i += 3) {
    if (r() < 0.45) continue
    const [a, b] = [river.pts[i - 1], river.pts[i + 1]]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const side = r() < 0.5 ? -1 : 1
    const d = side * (river.half[i] + range(r, -1, 3))
    const p = river.pts[i]
    put(p.x - ((b.z - a.z) / len) * d, p.z + ((b.x - a.x) / len) * d, range(r, 0.5, 1.5))
  }
}

/** Inside `q` grown by `m` meters on every side. */
const near = (q: Rect, x: number, z: number, m: number) =>
  x > q.x0 - m && x < q.x1 + m && z > q.z0 - m && z < q.z1 + m

/** Every rock along the shores, set on the ground and tilted with it. */
export function shoreRocks(land: Land, clear: Clearance, ground: Surface): Grounded[] {
  const out: Grounded[] = []
  const { quays, dredged, moles: rubble } = land.waterways.channels
  const place =
    (r: Rand): Put =>
    (x, z, s, sink = SINK.rock) => {
      if (clearAt(clear, x, z) === BLOCKED) return
      // No rock may overhang a quay; the moles' inner rows edge the dredged channel on purpose.
      if (quays.some((q) => near(q, x, z, Math.max(2, s * ROCK_SPREAD)))) return
      if (dredged.some((q) => near(q, x, z, 2))) return
      const up = upAt(ground, x, z, s * ROCK_SPREAD)
      const y = lie(ground, x, z, s * ROCK_SPREAD * ROCK_RIM, up) - sink * s
      out.push({ x, z, s, r: r() * Math.PI * 2, y, up, tint: pale(tint(r, 0.5)) })
    }
  // Each kind draws from its own stream, so changing one never reshuffles the others.
  const kind = (seed: number, f: (put: Put, r: Rand) => void) => {
    const r = rng(seed)
    f(place(r), r)
  }
  const shore = shoreline(land.frame.coast)
  kind(651, (put, r) => {
    riprap(shore, ground, put, r)
    outcrops(shore, ground, put, r)
  })
  kind(652, (put, r) => groynes(land, shore, put, r))
  kind(653, (put, r) => moles(rubble, put, r))
  kind(654, (put, r) => riverStones(land, put, r))
  return out
}
