import type { Land } from '../land/plan'
import { addMerged, type WorldCtx } from '../world/blocks'
import { pbr } from '../world/materials'
import * as THREE from 'three'
import { bridgeGeometry, LIFT, trimeshCollider } from './bridges'
import { markingGeometry } from './markings'
import { strip, sweep } from './sweep'

/**
 * Every road outside the city grid: asphalt, lane paint, and the highway's concrete.
 * One merged mesh per material: a few draw calls for the whole map. The highway and
 * its ramps collide as triangle meshes (bridges); the rest rest on the terrain they
 * are cut into.
 */
export function buildRoads(ctx: WorldCtx, land: Land): void {
  const paved = land.paths.filter((p) => p.kind !== 'trail')
  const surfaces = paved.map((p) => sweep(p.pts, strip(p.width / 2, -p.width / 2, LIFT), p.closed))
  const elevated = paved.filter((p) => p.kind === 'highway' || p.kind === 'ramp')
  elevated.forEach((p) => trimeshCollider(ctx, surfaces[paved.indexOf(p)]))
  const asphalt = pbr('asphalt_02', 0.25, {
    color: 0xb8b4ae,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  addMerged(ctx, surfaces, asphalt, { cast: false, receive: true })
  const paint = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.75,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  addMerged(ctx, markingGeometry(paved), paint, { cast: false, receive: true })
  const concrete = pbr('white_stucco', 0.3, { color: 0xcdc8c0, roughness: 0.92 })
  const under = paved.filter((p) => p.kind !== 'highway' && p.kind !== 'ramp')
  addMerged(ctx, bridgeGeometry(ctx, land, elevated, under), concrete)
}
