import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SEA_LEVEL } from '../city/layout'
import { heightAt } from '../city/terrain'
import type { Land } from '../land/plan'
import type { Ambient } from '../render/sky'
import type { WorldCtx } from '../world/blocks'
import { buildUnderwater } from '../world/underwater'
import { buildWater } from '../world/water'
import { buildLake } from '../world/lake'
import { LAKE, lakeSurfaceAt } from '../land/lake'
import type { V3 } from './boids'
import { CAUSTICS } from './caustics'
import { seaAt } from './field'
import { seaUniforms, type SeaUniforms } from './sea-glsl'
import { buildSeaLife } from './sea-life'
import { MAX_WAVE, waveHeightAt } from './waves'
import type { SeaData } from './sea-plan'

type Load = (url: string) => Promise<GLTF>

export interface SeaPlan extends SeaData {
  uniforms: SeaUniforms
}

/** Reefs and the baked sea field (sea-plan.ts, built in the plan worker) plus their shader uniforms. */
export function planSea(data: SeaData): SeaPlan {
  return { ...data, uniforms: seaUniforms(data.field) }
}

/** The sea, the view from under it, and its life. */
export async function buildSea(ctx: WorldCtx, c: Land, light: Ambient, load: Load, plan: SeaPlan) {
  const water = buildWater(ctx, c, light, plan.uniforms)
  const time = plan.uniforms.seaTime
  // One sample object reused: the wave query reads it before asking for the next.
  const sample = { scale: 1, shore: 0 }
  const at = (x: number, z: number) => seaAt(plan.field, x, z, sample)
  /** The sea's surface height at (x, z), waves included, or null on land. */
  const seaTop = (x: number, z: number) => {
    const top = SEA_LEVEL + waveHeightAt(x, z, time.value, at)
    return heightAt(c, x, z) < top ? top : null
  }
  /** Any water's surface at (x, z): the lake's still level, or the sea's. */
  const surfaceAt = (x: number, z: number) => {
    const lake = lakeSurfaceAt(LAKE, x, z)
    if (lake === null) return seaTop(x, z)
    return heightAt(c, x, z) < lake ? lake : null
  }
  const lake = buildLake(ctx, water.normals)
  const underwater = buildUnderwater({
    scene: ctx.scene,
    surface: water.surface,
    normals: water.normals,
    grid: water.grid,
    sea: plan.uniforms,
    light,
    // The view from below is the sea's: the lake is only a swim, not a dive.
    water: seaTop,
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
      lake(dt)
      underwater.update(camera, dt, light.day)
      life.update(dt, camera.position, swimmer)
    },
  }
}
