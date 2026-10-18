import * as THREE from 'three'
import type { CityLayout } from '../city/layout'
import { shopsFor } from '../city/shops'
import { pbrMaterial } from './bake-parts'
import { addMerged, type WorldCtx } from './blocks'
import { groupByChunk } from './chunks'
import type { PropKit } from './prop-kit'

/** The Blender awnings by style (city/shops.ts AWNING_STYLES), and each one's width. */
const STYLES: [name: string, width: number][] = [
  ['awning_striped', 3],
  ['awning_dome', 2.62],
  ['awning_flat', 3.2],
]
// Hung just above the shopfront picture, so its sign shows under the valance; clear of the plinth.
const RISE = 0.55
const OUT = 0.12
/** Wall left bare at each end of a shop. */
const MARGIN = 0.4

/** An awning over two in three shops under an upper floor, merged per chunk; they cast shade on the shops. */
export function buildAwnings(ctx: WorldCtx, c: CityLayout, kit: PropKit): void {
  const shops = c.blocks.flatMap(shopsFor).filter((s) => s.awning !== undefined)
  // Canvas is a single sheet, seen from below as much as above.
  const material = pbrMaterial({ side: THREE.DoubleSide })
  for (const list of groupByChunk(shops).values()) {
    const geos = list.map((s) => {
      const [name, width] = STYLES[s.awning!]
      return kit
        .get(name)!
        .clone()
        .scale((s.width - 2 * MARGIN) / width, 1, 1)
        .rotateY(Math.atan2(s.nx, s.nz))
        .translate(s.x + s.nx * OUT, s.height + RISE, s.z + s.nz * OUT)
    })
    addMerged(ctx, geos, material)
  }
}
