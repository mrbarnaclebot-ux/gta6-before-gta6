import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { SEA_LEVEL } from '../city/layout'
import { heightAt } from '../city/terrain'
import { gridRect } from '../land/grid'
import type { Land } from '../land/plan'
import type { Ambient } from '../render/sky'
import type { WorldCtx } from './blocks'
import { seesAny, wetBoxes } from './wet-areas'

const NORMALS = '/assets/textures/water/waternormals.jpg'
// Far past the fog distance so the plane edge never shows on the horizon.
const EXTENT = 40000
const DEPTH_RANGE = 12
const DEPTH_CELL = 8

/**
 * Water depth baked into a small texture from the same height function as the
 * seabed, so the shader can go turquoise and clear in the shallows and deep
 * blue offshore without a depth pre-pass.
 */
function depthTexture(c: Land) {
  const g = gridRect(c.ground)
  const w = Math.ceil((g.x1 - g.x0) / DEPTH_CELL) + 1
  const h = Math.ceil((g.z1 - g.z0) / DEPTH_CELL) + 1
  const data = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const depth = SEA_LEVEL - heightAt(c, g.x0 + i * DEPTH_CELL, g.z0 + j * DEPTH_CELL)
      data[j * w + i] = Math.round(THREE.MathUtils.clamp(depth / DEPTH_RANGE, 0, 1) * 255)
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType)
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  // Offset by half a cell so each sample sits at its texel center.
  const half = DEPTH_CELL / 2
  const rect = new THREE.Vector4(g.x0 - half, g.z0 - half, w * DEPTH_CELL, h * DEPTH_CELL)
  return { tex, rect }
}

const UNIFORMS = /* glsl */ `
uniform sampler2D depthMap;
uniform vec4 depthRect;
uniform vec3 shallowColor;
uniform float waterLight;
`

const SCATTER = /* glsl */ `
vec2 duv = (worldPosition.xz - depthRect.xy) / depthRect.zw;
bool outside = any(lessThan(duv, vec2(0.0))) || any(greaterThan(duv, vec2(1.0)));
float depth = outside ? 1.0 : texture2D(depthMap, duv).r;
vec3 tint = mix(shallowColor, waterColor, smoothstep(0.02, 0.5, depth));
vec3 scatter = (0.35 + 0.65 * max(0.0, dot(surfaceNormal, eyeDirection))) * tint * waterLight;
`

const OUTPUT = /* glsl */ `
float foam = (1.0 - smoothstep(0.0, 0.035, depth)) * (0.55 + 0.45 * noise.y);
outgoingLight = mix(outgoingLight, vec3(0.92) * waterLight, foam * 0.75);
float clarity = mix(0.3, 0.97, smoothstep(0.0, 0.4, depth));
gl_FragColor = vec4(outgoingLight, max(max(clarity, reflectance), foam));
`

interface WaterLook {
  normals: THREE.Texture
  depth: { tex: THREE.DataTexture; rect: THREE.Vector4 }
  light: Ambient
}

/** One planar-reflection sea with a `size`-pixel mirror, patched with the depth look below. */
function makeWater(look: WaterLook, size: number, wet: THREE.Box3[]): Water {
  const water = new Water(new THREE.PlaneGeometry(EXTENT, EXTENT), {
    textureWidth: size,
    textureHeight: size,
    waterNormals: look.normals,
    sunDirection: look.light.sunDir,
    waterColor: 0x0a5878,
    distortionScale: 2.5,
    fog: true,
  })
  const mat = water.material as THREE.ShaderMaterial
  Object.assign(mat.uniforms, {
    depthMap: { value: look.depth.tex },
    depthRect: { value: look.depth.rect },
    shallowColor: { value: new THREE.Color(0x3fd0c4) },
    waterLight: { value: 1 },
  })
  // Shared by reference: the sky retints it as the sun moves and sets.
  mat.uniforms.sunColor.value = look.light.sunColor
  mat.uniforms.size.value = 1.6
  patchShader(mat)
  mat.transparent = true
  water.rotation.x = -Math.PI / 2
  water.receiveShadow = true
  // The plane is always in view, so three would redraw the whole city into the mirror every
  // frame, even looking inland with no water on screen; that was about a quarter of the beach frame.
  const mirror = water.onBeforeRender
  water.onBeforeRender = (...args) => {
    if (seesAny(args[2], wet)) mirror.apply(water, args)
  }
  return water
}

/** Planar-reflection water (three.js Water) patched with depth-based color, clarity, and shore foam. */
export function buildWater(ctx: WorldCtx, c: Land, light: Ambient) {
  const normals = new THREE.TextureLoader().load(NORMALS)
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping
  const look = { normals, depth: depthTexture(c), light }
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
    /** Rebuilds the sea with a `size`-pixel mirror. */
    setReflection(size: number) {
      if (water) {
        if (water.material.uniforms.mirrorSampler.value.image.width === size) return
        surface.remove(water)
        // ponytail: Water keeps its mirror target private, so only its texture can be freed;
        // the framebuffer leaks a few MB per change. Fork Water.js if settings churn matters.
        water.material.uniforms.mirrorSampler.value.dispose()
        water.material.dispose()
        water.geometry.dispose()
      }
      surface.add((water = makeWater(look, size, wet)))
    },
    update(dt: number) {
      if (!water) return
      const u = water.material.uniforms
      u.time.value = time += dt * 0.6
      // Body color is lit by the sky, not the sun: dark blue at night instead of glowing turquoise.
      u.waterLight.value = 0.05 + 0.95 * light.day
    },
  }
}

function patchShader(mat: THREE.ShaderMaterial): void {
  mat.fragmentShader = mat.fragmentShader
    .replace('uniform vec3 waterColor;', 'uniform vec3 waterColor;' + UNIFORMS)
    .replace(/vec3 scatter = [^;]+;/, SCATTER)
    // Keep more body color at grazing angles so the sea reads turquoise, not mirror-silver.
    .replace(
      /reflectionSample \+ specularLight, reflectance \)/,
      'reflectionSample + specularLight, reflectance * 0.6 )',
    )
    // Shadow darkens only the sun-lit part of the body color; full masking turned
    // shaded water into opaque black stains over the seabed.
    .replace('* getShadowMask()', '* mix(0.5, 1.0, getShadowMask())')
    .replace('gl_FragColor = vec4( outgoingLight, alpha );', OUTPUT)
}
