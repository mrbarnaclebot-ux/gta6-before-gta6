import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SEA_LEVEL } from '../city/layout'
import { heightAt } from '../city/terrain'
import { gridRect } from '../land/grid'
import type { Land } from '../land/plan'
import type { Ambient } from '../render/sky'
import type { WorldCtx } from '../world/blocks'
import { buildUnderwater } from '../world/underwater'
import { buildWater } from '../world/water'
import type { V3 } from './boids'
import { CAUSTICS } from './caustics'
import { bakeSeaField, seaAt, type SeaField } from './field'
import { planReefs, type ReefPlan } from './reef-plan'
import { seaUniforms, type SeaUniforms } from './sea-glsl'
import { buildSeaLife } from './sea-life'
import { MAX_WAVE, waveHeightAt } from './waves'

type Load = (url: string) => Promise<GLTF>

export interface SeaPlan {
  reefs: ReefPlan
  field: SeaField
  uniforms: SeaUniforms
}

/** Ground height with the surf rocks stamped in, so the field sees them as land the surf foams around. */
function withRocks(c: Land, rocks: ReefPlan['surfRocks']) {
  return (x: number, z: number) => {
    const h = heightAt(c, x, z)
    const hit = rocks.find((r) => Math.hypot(r.x - x, r.z - z) < r.s * 0.4)
    return hit ? Math.max(h, hit.y + hit.s) : h
  }
}

/** Reefs and the baked sea field: plain data the terrain and water shaders both need first. */
export function planSea(c: Land): SeaPlan {
  const grid = gridRect(c.ground)
  const floor = (x: number, z: number) => heightAt(c, x, z)
  const reefs = planReefs(
    {
      depth: (x, z) => SEA_LEVEL - floor(x, z),
      floor,
      x0: c.land.x1,
      z0: grid.z0,
      z1: grid.z1,
    },
    SEA_LEVEL,
  )
  // Water exists only from the canal east: the land west of it never dips below sea level.
  const rect = { ...grid, x0: c.canal.x0 - 40 }
  const field = bakeSeaField(withRocks(c, reefs.surfRocks), SEA_LEVEL, rect, c.canal)
  return { reefs, field, uniforms: seaUniforms(field) }
}

/** The sea, the view from under it, and its life. */
export async function buildSea(ctx: WorldCtx, c: Land, light: Ambient, load: Load, plan: SeaPlan) {
  const water = buildWater(ctx, c, light, plan.uniforms)
  const time = plan.uniforms.seaTime
  const at = (x: number, z: number) => seaAt(plan.field, x, z)
  /** Water surface height at (x, z), waves included, or null on land. */
  const surfaceAt = (x: number, z: number) => {
    const top = SEA_LEVEL + waveHeightAt(x, z, time.value, at)
    return heightAt(c, x, z) < top ? top : null
  }
  const underwater = buildUnderwater({
    scene: ctx.scene,
    surface: water.surface,
    normals: water.normals,
    grid: water.grid,
    sea: plan.uniforms,
    light,
    water: surfaceAt,
  })
  const floor = (x: number, z: number) => heightAt(c, x, z)
  // Below the deep-water troughs, so a fleeing school never breaks the surface.
  const surface = SEA_LEVEL - MAX_WAVE * 0.6
  const life = await buildSeaLife(ctx, plan.reefs, load, { floor, surface })
  return {
    surfaceAt,
    underwater,
    life,
    setReflection: water.setReflection,
    update(dt: number, camera: THREE.Camera, swimmer: V3 | null) {
      time.value += dt
      CAUSTICS.causticGain.value = light.day * Math.min(1, Math.max(0, light.sunDir.y) * 3)
      water.update(dt, camera)
      underwater.update(camera, dt, light.day)
      life.update(dt, camera.position, swimmer)
    },
  }
}
