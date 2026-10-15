import type { Grounded } from '../city/layout'
import { range, type Rand } from '../city/rng'
import { stand, type Surface } from './footing'
import type { P2 } from './polyline'

/** Trunk radius as a share of tree height; trunks and stems sink this far below their lowest ground. */
export const TRUNK = 0.018
export const SINK = { tree: 0.08, bush: 0.05, palm: 0.08, rock: 0.12 }
/** A rock's footprint radius per meter of height, and the share of it that must touch down. */
export const ROCK_SPREAD = 1
export const ROCK_RIM = 0.7

/** A slight per-plant shift in brightness and hue, as a color multiplier. */
export function tint(r: Rand, spread = 1): number {
  const v = 1 + spread * range(r, -0.14, 0.08)
  const warm = spread * range(r, -0.05, 0.05)
  const ch = (k: number) => Math.round(Math.min(1, Math.max(0, k)) * 255)
  return (ch(v * (1 + warm)) << 16) | (ch(v) << 8) | ch(v * (1 - warm * 1.5))
}

/** An upright plant of height `h` with a trunk or stem `radius` wide. */
export function upright(
  surface: Surface,
  p: P2,
  h: number,
  radius: number,
  sink: number,
  r: Rand,
): Grounded {
  const y = stand(surface, p.x, p.z, radius, sink)
  return { x: p.x, z: p.z, s: h, r: r() * Math.PI * 2, y, tint: tint(r) }
}
