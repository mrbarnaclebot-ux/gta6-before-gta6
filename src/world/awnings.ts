import * as THREE from 'three'
import type { CityLayout } from '../city/layout'
import { SHOP_W, shopsFor } from '../city/shops'
import { pbrMaterial } from './bake-parts'
import type { WorldCtx } from './blocks'
import { instanceByDistance } from './lod-instances'
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
/** Awnings are drawn this close to the camera; past it a street's awnings are a few pixels. */
const REACH = 260

/**
 * An awning over two in three shops under an upper floor, instanced per style near the
 * camera; they cast shade on the shopfronts. Returns the per-frame update.
 */
export function buildAwnings(ctx: WorldCtx, c: CityLayout, kit: PropKit) {
  const shops = c.blocks.flatMap(shopsFor).filter((s) => s.awning !== undefined)
  // Canvas is a single sheet, seen from below as much as above.
  const material = pbrMaterial({ side: THREE.DoubleSide })
  const updates = STYLES.map(([name, width], k) => {
    // Every shop is SHOP_W wide, so one stretched model serves a whole style.
    const geometry = kit
      .get(name)!
      .clone()
      .scale((SHOP_W - 2 * MARGIN) / width, 1, 1)
    const spots = shops
      .filter((s) => s.awning === k)
      .map((s) => ({
        x: s.x + s.nx * OUT,
        y: s.height + RISE,
        z: s.z + s.nz * OUT,
        r: Math.atan2(s.nx, s.nz),
        s: 1,
      }))
    const update = instanceByDistance(ctx, [[{ geometry, material }]], spots, {
      scale: () => 1,
      ranges: [],
      chunk: 1000,
    })
    return (eye: THREE.Vector3) => update(eye, 1, REACH)
  })
  return (eye: THREE.Vector3) => updates.forEach((u) => u(eye))
}
