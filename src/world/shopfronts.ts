import { shopsFor } from '../city/shops'
import type { CityLayout } from '../city/layout'
import { addMerged, type WorldCtx } from './blocks'
import { groupByChunk } from './chunks'
import { DETAIL_LAYER } from './instancing'
import { signMaterial, signQuad } from './sign-material'

// In front of the wall and its 8 cm plinth, so neither shows through.
const OUT = 0.1

/** The owner's shopfront pictures on the street walls of low-rise buildings, merged per chunk. */
export function buildShopfronts(ctx: WorldCtx, c: CityLayout): void {
  const shops = c.blocks.flatMap(shopsFor)
  const mat = signMaterial()
  for (const list of groupByChunk(shops).values()) {
    const geos = list.map((s) =>
      signQuad(s.width, s.height, s.kind)
        .rotateY(Math.atan2(s.nx, s.nz))
        .translate(s.x + s.nx * OUT, 0, s.z + s.nz * OUT),
    )
    // Detail layer: the sea mirror and the shadow passes skip them.
    addMerged(ctx, geos, mat, { cast: false, receive: true })?.layers.set(DETAIL_LAYER)
  }
}
