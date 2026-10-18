import * as THREE from 'three'
import { pbrMaterial } from './bake-parts'
import type { WorldCtx } from './blocks'
import { instanceByDistance } from './lod-instances'
import type { PropKit } from './prop-kit'
import type { RoofProp } from './rooftops'

/** The models are drawn within this many meters; past it the trim's stand-ins carry on alone. */
const NEAR = 150

/**
 * Every roof's AC units and water tanks as the Blender models near the camera: on the detail
 * layer (main view only; the stand-ins cast the shadows and show in the sea mirror), a few
 * draw calls for the whole city. Returns the per-frame update.
 */
export function instanceRoofProps(ctx: WorldCtx, kit: PropKit, props: RoofProp[]) {
  const material = pbrMaterial()
  const updates = (['ac', 'tank'] as const).map((kind) => {
    const geometry = kit.get(kind === 'ac' ? 'ac_unit' : 'water_tank')
    if (!geometry) return () => {}
    const spots = props.filter((p) => p.kind === kind)
    return instanceByDistance(ctx, [[{ geometry, material }]], spots, {
      scale: (s) => s.s,
      ranges: [],
      detail: true,
      // The city is under a kilometer across: a few big batches.
      chunk: 1000,
    })
  })
  return (eye: THREE.Vector3) => updates.forEach((u) => u(eye, 1, NEAR))
}
