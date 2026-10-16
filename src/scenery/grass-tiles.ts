import { GRASS_TILE } from '../land/grass'

/*
 * The grass tiles around the camera, cached. Building a tile walks a thousand cells, so a
 * frame builds only what fits its time budget, nearest first, starting half a tile beyond the
 * grass range so tiles are ready before they come into view. Tiles well out of range are dropped.
 */

/** Builds one tile's data from its tile coordinates. */
export type BuildTile = (ti: number, tj: number) => Float32Array

const key = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768)

/** Squared distance from (x, z) to tile (i, j)'s square. */
function gap2(x: number, z: number, i: number, j: number): number {
  const dx = Math.max(i * GRASS_TILE - x, 0, x - (i + 1) * GRASS_TILE)
  const dz = Math.max(j * GRASS_TILE - z, 0, z - (j + 1) * GRASS_TILE)
  return dx * dx + dz * dz
}

export class GrassTiles {
  private readonly tiles = new Map<number, { i: number; j: number; data: Float32Array }>()
  private readonly missing: { i: number; j: number; d: number }[] = []

  constructor(private readonly build: BuildTile) {}

  /** Builds missing tiles near (x, z) for up to `budget` ms. True when any tile was added. */
  fill(x: number, z: number, radius: number, budget: number): boolean {
    this.drop(x, z, radius + 2 * GRASS_TILE)
    this.findMissing(x, z, radius + GRASS_TILE / 2)
    const t0 = performance.now()
    let added = false
    for (const m of this.missing) {
      if (added && performance.now() - t0 > budget) break
      this.tiles.set(key(m.i, m.j), { i: m.i, j: m.j, data: this.build(m.i, m.j) })
      added = true
    }
    return added
  }

  /** Calls `each` with the data of every cached tile within `radius` of (x, z). */
  forEach(x: number, z: number, radius: number, each: (data: Float32Array) => void): void {
    for (const t of this.tiles.values()) if (gap2(x, z, t.i, t.j) <= radius * radius) each(t.data)
  }

  get size(): number {
    return this.tiles.size
  }

  private findMissing(x: number, z: number, reach: number): void {
    this.missing.length = 0
    const at = (v: number) => Math.floor(v / GRASS_TILE)
    for (let i = at(x - reach); i <= at(x + reach); i++) {
      for (let j = at(z - reach); j <= at(z + reach); j++) {
        const d = gap2(x, z, i, j)
        if (d <= reach * reach && !this.tiles.has(key(i, j))) this.missing.push({ i, j, d })
      }
    }
    this.missing.sort((a, b) => a.d - b.d)
  }

  private drop(x: number, z: number, far: number): void {
    for (const [k, t] of this.tiles) if (gap2(x, z, t.i, t.j) > far * far) this.tiles.delete(k)
  }
}
