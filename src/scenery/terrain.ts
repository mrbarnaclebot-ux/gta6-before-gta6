import { CELL } from '../land/grid'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import type { WorldCtx } from '../world/blocks'
import type { SeaUniforms } from '../sea/sea-glsl'
import { terrainMaterial } from './terrain-material'
import { buildTerrainMesh } from './terrain-mesh'
import { terrainTextures } from './terrain-textures'

/** The ground of the whole map: splat-textured LOD tiles and one Rapier heightfield. Past its edge lies open sea (sea/offshore.ts). */
export async function buildTerrain(
  ctx: WorldCtx,
  land: Land,
  /** Per grid vertex: sand, dirt, crown shade, variation (land/splat.ts). */
  splat: Float32Array,
  sea: SeaUniforms,
): Promise<void> {
  const tex = await terrainTextures()
  buildTerrainMesh(ctx.scene, land, terrainMaterial(tex.albedo, tex.normal, sea), splat)
  const g = land.ground
  const w = g.nx * CELL
  const d = g.nz * CELL
  const desc = RAPIER.ColliderDesc.heightfield(g.nz, g.nx, g.h, { x: w, y: 1, z: d })
  ctx.physics.createCollider(desc.setTranslation(g.x0 + w / 2, 0, g.z0 + d / 2))
}
