import { CELL, gridRect } from '../land/grid'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import { rectCollider, type WorldCtx } from '../world/blocks'
import type { SeaUniforms } from '../sea/sea-glsl'
import { terrainMaterial } from './terrain-material'
import { buildTerrainMesh } from './terrain-mesh'
import { terrainTextures } from './terrain-textures'

/** The ground of the whole map: splat-textured LOD tiles, one Rapier heightfield, and edge walls. */
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
  boundary(ctx, land)
}

/**
 * Invisible walls at the terrain's edge: the ridge on three sides, open sea on the fourth.
 * ponytail: hard walls; a soft current offshore would feel kinder if swimmers ever reach it.
 */
function boundary(ctx: WorldCtx, land: Land): void {
  const r = gridRect(land.ground)
  const t = 1
  for (const side of [
    { ...r, x1: r.x0, x0: r.x0 - t },
    { ...r, x0: r.x1, x1: r.x1 + t },
    { ...r, z1: r.z0, z0: r.z0 - t },
    { ...r, z0: r.z1, z1: r.z1 + t },
  ]) {
    rectCollider(ctx, side, -20, 200)
  }
}
