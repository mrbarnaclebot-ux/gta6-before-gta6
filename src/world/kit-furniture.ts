import * as THREE from 'three'
import type { Furniture } from '../city/furniture'
import { pbrMaterial } from './bake-parts'
import type { WorldCtx } from './blocks'
import { KIT_MODELS } from './furniture-models'
import { instanceByDistance } from './lod-instances'
import type { PropKit } from './prop-kit'

/**
 * The Blender street furniture, instanced per kind and drawn only near the camera (each kind's
 * reach in KIT_MODELS): a few hundred triangles each, too many to merge across the whole city.
 * Detail layer, as the merged furniture: main view only, no shadow pass. Returns the update.
 */
export function instanceKitFurniture(ctx: WorldCtx, items: Furniture[], kit: PropKit) {
  const solid = pbrMaterial()
  // The bus shelters' panes: clear glass, so the bench and the street show through.
  const clear = pbrMaterial({ transparent: true, opacity: 0.3, depthWrite: false })
  const updates = Object.entries(KIT_MODELS).map(([kind, { name, reach }]) => {
    const spots = items.filter((f) => f.kind === kind).map((f) => ({ ...f, s: 1 }))
    const glass = kit.get(`${name}:glass`)
    const parts = [{ geometry: kit.get(name)!, material: solid }]
    if (glass) parts.push({ geometry: glass, material: clear })
    const update = instanceByDistance(ctx, [parts], spots, {
      scale: () => 1,
      ranges: [],
      detail: true,
      // The city is under a kilometer across: a few big batches.
      chunk: 1000,
    })
    return (eye: THREE.Vector3) => update(eye, 1, reach)
  })
  return (eye: THREE.Vector3) => updates.forEach((u) => u(eye))
}
