import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { SEA_LEVEL } from '../city/layout'
import { heightAt } from '../city/terrain'
import { gridRect } from '../land/grid'
import type { Land } from '../land/plan'
import type { Ambient } from '../render/sky'
import { foamTexture } from '../sea/foam-texture'
import type { SeaUniforms } from '../sea/sea-glsl'
import { gridAnchor, seaGrid } from '../sea/sea-grid'
import { patchWater } from '../sea/water-shader'
import type { WorldCtx } from './blocks'
import { seesAny, wetBoxes } from './wet-areas'

const NORMALS = '/assets/textures/water/waternormals.jpg'
const ANCHOR = new THREE.Vector3()

interface WaterLook {
  normals: THREE.Texture
  foam: THREE.Texture
  sea: SeaUniforms
  light: Ambient
  grid: THREE.BufferGeometry
}

/** One planar-reflection sea with a `size`-pixel mirror, patched with waves, depth color, and foam. */
function makeWater(look: WaterLook, size: number, wet: THREE.Box3[]): Water {
  const water = new Water(look.grid, {
    textureWidth: size,
    textureHeight: size,
    waterNormals: look.normals,
    sunDirection: look.light.sunDir,
    waterColor: 0x0a5878,
    distortionScale: 2.5,
    fog: true,
  })
  const mat = water.material as THREE.ShaderMaterial
  // The sea uniforms are shared by reference: one clock and field for every sea shader.
  Object.assign(mat.uniforms, look.sea, {
    foamMap: { value: look.foam },
    shallowColor: { value: new THREE.Color(0x3fd0c4) },
    waterLight: { value: 1 },
  })
  // Shared by reference: the sky retints it as the sun moves and sets.
  mat.uniforms.sunColor.value = look.light.sunColor
  mat.uniforms.size.value = 1.6
  patchWater(mat)
  mat.transparent = true
  water.rotation.x = -Math.PI / 2
  water.receiveShadow = true
  water.frustumCulled = false
  // The sea is always in view, so three would redraw the whole city into the mirror every
  // frame, even looking inland with no water on screen; that was about a quarter of the beach frame.
  const mirror = water.onBeforeRender
  water.onBeforeRender = (...args) => {
    if (seesAny(args[2], wet)) mirror.apply(water, args)
  }
  return water
}

/** Planar-reflection water (three.js Water) on a camera-following wave grid. */
export function buildWater(ctx: WorldCtx, c: Land, light: Ambient, sea: SeaUniforms) {
  const normals = new THREE.TextureLoader().load(NORMALS)
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping
  const look = { normals, foam: foamTexture(), sea, light, grid: seaGrid() }
  const wet = wetBoxes((x, z) => heightAt(c, x, z), gridRect(c.ground))
  // The sea sits in a group so its mirror size can change without the rest of the city noticing.
  const surface = new THREE.Group()
  surface.position.set((c.land.x0 + c.land.x1) / 2, SEA_LEVEL, 0)
  ctx.scene.add(surface)
  // Built on the first setReflection, at the mirror size the graphics settings ask for.
  let water: Water | null = null
  let time = 0
  return {
    surface: surface as THREE.Object3D,
    normals,
    grid: look.grid,
    /** Rebuilds the sea with a `size`-pixel mirror. */
    setReflection(size: number) {
      if (water) {
        if (water.material.uniforms.mirrorSampler.value.image.width === size) return
        surface.remove(water)
        // ponytail: Water keeps its mirror target private, so only its texture can be freed;
        // the framebuffer leaks a few MB per change. Fork Water.js if settings churn matters.
        water.material.uniforms.mirrorSampler.value.dispose()
        water.material.dispose()
      }
      surface.add((water = makeWater(look, size, wet)))
    },
    update(dt: number, camera: THREE.Camera) {
      if (!water) return
      const u = water.material.uniforms
      u.time.value = time += dt * 0.6
      // Body color is lit by the sky, not the sun: dark blue at night instead of glowing turquoise.
      u.waterLight.value = 0.05 + 0.95 * light.day
      gridAnchor(camera.position.x, camera.position.z, ANCHOR).sub(surface.position)
      water.position.set(ANCHOR.x, 0, ANCHOR.z)
    },
  }
}
