import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { bakeParts } from './bake-parts'

/*
 * The Blender street kit, awnings, and lifeguard tower (assets-src/blender/props.py), each
 * prop baked into one geometry in its own space (origin on the ground, front +z) with its
 * materials as vertex attributes, ready to merge or instance with `pbrMaterial`.
 */

const FILES = ['street_kit', 'awnings', 'lifeguard_tower']
/** Body paint that a caller may change per placed prop (`repaint`): `pbr.w` is 1 there. */
const PAINTS = new Set(['tower_pink', 'kiosk_paint', 'bike_paint', 'scooter_paint'])
const paintCode = (name: string) => (PAINTS.has(name) ? 1 : 0)

/**
 * Prop name (bench, bin, hydrant, kiosk, bus_shelter, ac_unit, water_tank, awning_*, ...) to
 * its opaque geometry; `<name>:glass` holds its see-through panes, if it has any.
 */
export type PropKit = Map<string, THREE.BufferGeometry>

export async function loadPropKit(load: (url: string) => Promise<GLTF>): Promise<PropKit> {
  const kit: PropKit = new Map()
  const scenes = await Promise.all(FILES.map((f) => load(`/assets/models/props/${f}.glb`)))
  for (const { scene } of scenes) {
    scene.updateMatrixWorld(true)
    for (const root of scene.children) {
      const baked = bakeParts([root], root.matrixWorld.clone().invert(), paintCode, true)
      kit.set(root.name, baked.solid)
      if (baked.clear) kit.set(`${root.name}:glass`, baked.clear)
    }
  }
  return kit
}

/** A copy of a prop with its body paint (see PAINTS) in `hex` (sRGB). */
export function repaint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const out = geo.clone()
  const color = new THREE.Color(hex)
  const pbr = out.getAttribute('pbr')
  const col = out.getAttribute('color')
  for (let i = 0; i < pbr.count; i++)
    if (pbr.getW(i) === 1) col.setXYZ(i, color.r, color.g, color.b)
  return out
}
