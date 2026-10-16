import { CELL, type HeightGrid } from './grid'
import type { P3 } from './polyline'
import { smoothstep } from './noise'

// Fill under a road higher than this above the ground tapers off: past it the road is a bridge on piers.
export const EMBANK = 2.5
const EMBANK_FADE = 2

/**
 * Cuts and fills the natural ground to roads and building pads. Each grid vertex takes
 * the strongest stamp touching it: full strength on the flat part, easing back to
 * the natural ground over a blend band that widens with the height difference.
 */
export class Shaper {
  readonly weight: Float32Array
  readonly target: Float32Array
  /** 0 to 1 per vertex: how much the ground reads as bare dirt (trails, pads). */
  readonly dirt: Float32Array
  private readonly near: Float32Array

  constructor(
    readonly grid: HeightGrid,
    readonly natural: Float32Array,
  ) {
    this.weight = new Float32Array(natural.length)
    this.target = new Float32Array(natural.length)
    this.dirt = new Float32Array(natural.length)
    this.near = new Float32Array(natural.length).fill(Infinity)
  }

  /** Visits every vertex within the box, with its world position and index. */
  private each(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    f: (x: number, z: number, k: number) => void,
  ) {
    const g = this.grid
    const i0 = Math.max(0, Math.floor((x0 - g.x0) / CELL))
    const i1 = Math.min(g.nx, Math.ceil((x1 - g.x0) / CELL))
    const j0 = Math.max(0, Math.floor((z0 - g.z0) / CELL))
    const j1 = Math.min(g.nz, Math.ceil((z1 - g.z0) / CELL))
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) f(g.x0 + i * CELL, g.z0 + j * CELL, i * (g.nz + 1) + j)
    }
  }

  /** Offers one vertex a target height at distance `d` from the stamp's flat part. */
  private offer(
    k: number,
    d: number,
    flat: number,
    y: number,
    blend: number,
    dirt: number,
    bridges = false,
  ) {
    const nat = this.natural[k]
    let target = y
    const lift = y - nat
    if (bridges && lift > EMBANK) {
      // A tapering earth ramp under the start of a bridge, none under its span.
      const left = EMBANK * (1 - (lift - EMBANK) / EMBANK_FADE)
      if (left <= 0) return
      target = nat + left
    }
    const band = blend + 1.3 * Math.abs(target - nat)
    const w = d <= flat ? 1 : 1 - smoothstep(flat, flat + band, d)
    // Ties (two flat parts) go to the nearer centerline: a street under a bridge wins over
    // the highway's shoulder, and each road segment over its neighbours' clamped ends.
    if (w === 0 || w < this.weight[k] || (w === this.weight[k] && d >= this.near[k])) return
    this.weight[k] = w
    this.near[k] = d
    this.target[k] = target
    this.dirt[k] = Math.max(this.dirt[k], dirt * w)
  }

  /**
   * A road corridor along `pts`, flat for `flat` meters either side of its centerline.
   * With `bridges`, stretches high above the ground get no fill: they stand on piers.
   */
  road(pts: P3[], flat: number, blend: number, dirt = 0, bridges = false): void {
    const reach = flat + blend + 20
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1]
      const b = pts[s]
      const len2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2 || 1
      const x0 = Math.min(a.x, b.x) - reach
      const z0 = Math.min(a.z, b.z) - reach
      this.each(x0, z0, Math.max(a.x, b.x) + reach, Math.max(a.z, b.z) + reach, (x, z, k) => {
        const t = Math.max(
          0,
          Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / len2),
        )
        const d = Math.hypot(x - a.x - (b.x - a.x) * t, z - a.z - (b.z - a.z) * t)
        this.offer(k, d, flat, a.y + (b.y - a.y) * t, blend, dirt, bridges)
      })
    }
  }

  /** A level pad: a w x d rectangle turned by `yaw` (0: w along x), or a disc when `d` is 0 (w is its radius). */
  pad(c: P3, w: number, d: number, yaw: number, blend: number, dirt = 0): void {
    const reach = Math.max(w, d) + blend + 20
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    this.each(c.x - reach, c.z - reach, c.x + reach, c.z + reach, (x, z, k) => {
      const dx = x - c.x
      const dz = z - c.z
      const out = d
        ? Math.hypot(
            Math.max(0, Math.abs(dx * cos - dz * sin) - w / 2),
            Math.max(0, Math.abs(dx * sin + dz * cos) - d / 2),
          )
        : Math.max(0, Math.hypot(dx, dz) - w)
      this.offer(k, out, 0, c.y, blend, dirt)
    })
  }

  /** Writes the stamped heights into the grid. */
  apply(): void {
    const { h } = this.grid
    for (let k = 0; k < h.length; k++) {
      h[k] = this.natural[k] + (this.target[k] - this.natural[k]) * this.weight[k]
    }
  }
}
