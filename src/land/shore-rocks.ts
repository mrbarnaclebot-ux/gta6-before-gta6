import { SEA_LEVEL, type Grounded, type Rect } from '../city/layout'
import { range, rng, type Rand } from '../city/rng'
import { BLOCKED, clearAt, type Clearance } from './clearance'
import { sandAt, seaward } from './coast'
import { lie, upAt, type Surface } from './footing'
import type { Land } from './plan'
import { ROCK_RIM, ROCK_SPREAD, SINK, tint } from './plant'
import { wildness } from './shape'

/*
 * Rocks the sea has put to work: the canal's breakwaters, groynes across the wild beaches,
 * riprap and fallen boulders along every rocky shore, outcrops where beach meets rock, and
 * stones on the river's banks. All are the forest's moss rocks, tinted paler.
 */

const GROYNE = { gap: 260, from: 26, to: 112 }

/** Sun-bleached and salt-washed: a quarter of the way from a tint to white. */
const pale = (c: number) =>
  [16, 8, 0].reduce((out, sh) => {
    const v = (c >> sh) & 255
    return out | (Math.round(v + (255 - v) * 0.25) << sh)
  }, 0)

type Put = (x: number, z: number, s: number) => void

/** A point on the coast line, the way out to sea, its sandiness, and meters along the line. */
interface Shore {
  x: number
  z: number
  nx: number
  nz: number
  sand: number
  s: number
}

function shoreline(land: Land): Shore[] {
  const { coast } = land.frame
  const line = coast.line
  const out: Shore[] = []
  let s = 0
  for (let i = 1; i + 1 < line.length; i++) {
    s += Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z)
    const tx = line[i + 1].x - line[i - 1].x
    const tz = line[i + 1].z - line[i - 1].z
    const len = Math.hypot(tx, tz)
    let [nx, nz] = [tz / len, -tx / len]
    if (seaward(coast, line[i].x + nx * 10, line[i].z + nz * 10) < 0) [nx, nz] = [-nx, -nz]
    out.push({ ...line[i], nx, nz, sand: sandAt(coast, line[i].x, line[i].z), s })
  }
  return out
}

/** Riprap at the waterline below every rocky shore, a second row half drowned. */
function riprap(shore: Shore[], ground: Surface, put: Put, r: Rand) {
  let next = 0
  for (const p of shore) {
    if (p.sand > 0.3 || p.s < next) continue
    next = p.s + range(r, 2.6, 4.2)
    let d = 0
    while (d < 60 && ground(p.x + p.nx * d, p.z + p.nz * d) > SEA_LEVEL + 0.4) d += 1
    for (const [k, big] of [
      [-1.5, 1],
      [1.2, 0.8],
    ]) {
      const dd = d + k + range(r, -0.8, 0.8)
      const side = range(r, -1.2, 1.2)
      put(p.x + p.nx * dd - p.nz * side, p.z + p.nz * dd + p.nx * side, big * range(r, 0.9, 2.2))
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

/** Every rock along the shores, set on the ground and tilted with it. */
export function shoreRocks(land: Land, clear: Clearance, ground: Surface): Grounded[] {
  const r = rng(651)
  const out: Grounded[] = []
  const { quays, dredged } = land.waterways.channels
  const keepOut = [...quays, ...dredged].map((q) => ({
    x0: q.x0 - 2,
    x1: q.x1 + 2,
    z0: q.z0 - 2,
    z1: q.z1 + 2,
  }))
  const put: Put = (x, z, s) => {
    if (clearAt(clear, x, z) === BLOCKED) return
    if (keepOut.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1)) return
    const up = upAt(ground, x, z, s * ROCK_SPREAD)
    const y = lie(ground, x, z, s * ROCK_SPREAD * ROCK_RIM, up) - SINK.rock * s
    out.push({ x, z, s, r: r() * Math.PI * 2, y, up, tint: pale(tint(r, 0.5)) })
  }
  const shore = shoreline(land)
  riprap(shore, ground, put, r)
  groynes(land, shore, put, r)
  moles(land.waterways.channels.moles, put, r)
  riverStones(land, put, r)
  return out
}
