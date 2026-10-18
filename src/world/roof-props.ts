import * as THREE from 'three'
import { pbrMaterial, withPbr } from './bake-parts'
import { metricBox, tinted, type WorldCtx } from './blocks'
import { instanceByDistance } from './lod-instances'
import type { PropKit } from './prop-kit'
import type { RoofProp } from './rooftops'

/** Past this many meters a rooftop unit or tank draws as a plain block. */
const NEAR = 150

/** The far stand-ins: the AC unit's box, and the tank's barrel up on its stand. */
function far(kind: RoofProp['kind']): THREE.BufferGeometry {
  const geo =
    kind === 'ac'
      ? tinted(metricBox(0.9, 0.79, 0.9).translate(0, 0.395, 0), 0x9a9ea1)
      : tinted(new THREE.CylinderGeometry(1.05, 1.05, 2.6, 8).translate(0, 3.2, 0), 0x6b5440)
  return withPbr(geo, 0.6, 0.2)
}

/**
 * Every roof's AC units and water tanks: the Blender models near the camera, blocks farther
 * out, a few draw calls for the whole city. Returns the per-frame level-of-detail update.
 */
export function instanceRoofProps(ctx: WorldCtx, kit: PropKit, props: RoofProp[]) {
  const material = pbrMaterial()
  const updates = (['ac', 'tank'] as const).map((kind) => {
    const model = kit.get(kind === 'ac' ? 'ac_unit' : 'water_tank')!
    const levels = [model, far(kind)].map((geometry) => [{ geometry, material }])
    const spots = props.filter((p) => p.kind === kind)
    return instanceByDistance(ctx, levels, spots, {
      scale: (s) => s.s,
      ranges: [NEAR],
      // The city is under a kilometer across: a few big batches.
      chunk: 1000,
    })
  })
  return (eye: THREE.Vector3) => updates.forEach((u) => u(eye))
}
