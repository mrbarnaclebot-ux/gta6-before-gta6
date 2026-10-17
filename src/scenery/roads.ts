import { heightAt } from '../city/terrain'
import type { Land } from '../land/plan'
import { DECK_FROM, type Path } from '../land/path'
import { addTiled, type WorldCtx } from '../world/blocks'
import { pbr } from '../world/materials'
import { wornAsphalt, wornPaint } from '../render/road-wear'
import * as THREE from 'three'
import { bridgeGeometry, LIFT, trimeshCollider } from './bridges'
import { markingGeometry } from './markings'
import { strip, sweep } from './sweep'

/**
 * Every road outside the city grid: asphalt, lane paint, and the highway's concrete.
 * Merged per material and cut along the 256 m terrain tiles, so only tiles in view draw. The highway and
 * its ramps collide as triangle meshes (bridges); the rest rest on the terrain they
 * are cut into.
 */
export function buildRoads(ctx: WorldCtx, land: Land): void {
  const paved = land.paths.filter((p) => p.kind !== 'trail')
  const surfaces = paved.map((p) => sweep(p.pts, strip(p.width / 2, -p.width / 2, LIFT), p.closed))
  // The highway and its ramps, and any road that crosses water, stand on decks where they leave the ground.
  const lifted = (p: Path) => p.pts.some((q) => q.y - heightAt(land, q.x, q.z) > DECK_FROM)
  const elevated = paved.filter((p) => p.kind === 'highway' || p.kind === 'ramp' || lifted(p))
  elevated.forEach((p) => trimeshCollider(ctx, surfaces[paved.indexOf(p)]))
  const asphalt = wornAsphalt(
    pbr('asphalt_02', 0.25, {
      color: 0xb8b4ae,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  )
  addTiled(ctx, surfaces, asphalt, { cast: false, receive: true })
  const paint = wornPaint(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.75,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  )
  addTiled(ctx, markingGeometry(paved), paint, { cast: false, receive: true })
  const concrete = pbr('white_stucco', 0.3, { color: 0xcdc8c0, roughness: 0.92 })
  const under = paved.filter((p) => p.kind !== 'highway' && p.kind !== 'ramp')
  // Facet normals: concrete has hard edges, and smooth ones made the barrier look like a tube.
  const crisp = (g: THREE.BufferGeometry) => {
    const flat = g.toNonIndexed()
    flat.computeVertexNormals()
    return flat
  }
  addTiled(ctx, bridgeGeometry(ctx, land, elevated, under).map(crisp), concrete)
}
