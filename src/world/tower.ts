import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RAPIER } from '../physics'
import { metricBox, type WorldCtx } from './blocks'

const FLOOR_H = 3.6
const SPANDREL_H = 1.2
const PIER = 1.1

export interface TowerSpec {
  x: number
  z: number
  w: number
  d: number
  floors: number
}

function part(w: number, h: number, d: number, x: number, y: number, z: number) {
  return metricBox(w, h, d).translate(x, y, z)
}

/** Stucco frame: ribbon spandrels per floor, corner piers, and an art-deco stepped crown. */
function frameParts({ w, d, floors }: TowerSpec): THREE.BufferGeometry[] {
  const h = floors * FLOOR_H
  const parts = []
  for (let i = 0; i < floors; i++) {
    parts.push(part(w, SPANDREL_H, d, 0, i * FLOOR_H + SPANDREL_H / 2, 0))
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(part(PIER, h, PIER, (sx * (w - PIER)) / 2, h / 2, (sz * (d - PIER)) / 2))
    }
  }
  parts.push(part(w, 1.4, d, 0, h + 0.7, 0))
  parts.push(part(w * 0.7, 4, d * 0.7, 0, h + 3.4, 0))
  parts.push(part(w * 0.4, 5, d * 0.4, 0, h + 7.9, 0))
  parts.push(part(0.5, 8, 0.5, 0, h + 14.4, 0))
  return parts
}

export function tower(
  ctx: WorldCtx,
  spec: TowerSpec,
  stucco: THREE.Material,
  glass: THREE.Material,
): void {
  const h = spec.floors * FLOOR_H
  const frame = new THREE.Mesh(mergeGeometries(frameParts(spec)), stucco)
  const core = new THREE.Mesh(metricBox(spec.w - 0.6, h, spec.d - 0.6), glass)
  core.position.y = h / 2
  for (const m of [frame, core]) {
    m.position.x += spec.x
    m.position.z += spec.z
    m.castShadow = m.receiveShadow = true
    ctx.scene.add(m)
  }
  const collider = RAPIER.ColliderDesc.cuboid(spec.w / 2, h / 2 + 1, spec.d / 2)
  ctx.physics.createCollider(collider.setTranslation(spec.x, h / 2 + 1, spec.z))
}
