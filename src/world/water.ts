import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { SEA_LEVEL, type CityLayout } from '../city/layout'
import { heightAt, terrainGrid } from '../city/terrain'
import type { WorldCtx } from './blocks'

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
function depthTexture(c: CityLayout) {
  const g = terrainGrid(c)
  const w = Math.ceil(g.width / DEPTH_CELL) + 1
  const h = Math.ceil(g.depth / DEPTH_CELL) + 1
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
`

const SCATTER = /* glsl */ `
vec2 duv = (worldPosition.xz - depthRect.xy) / depthRect.zw;
bool outside = any(lessThan(duv, vec2(0.0))) || any(greaterThan(duv, vec2(1.0)));
float depth = outside ? 1.0 : texture2D(depthMap, duv).r;
vec3 tint = mix(shallowColor, waterColor, smoothstep(0.02, 0.5, depth));
vec3 scatter = (0.35 + 0.65 * max(0.0, dot(surfaceNormal, eyeDirection))) * tint;
`

const OUTPUT = /* glsl */ `
float foam = (1.0 - smoothstep(0.0, 0.035, depth)) * (0.55 + 0.45 * noise.y);
outgoingLight = mix(outgoingLight, vec3(0.92), foam * 0.75);
float clarity = mix(0.3, 0.97, smoothstep(0.0, 0.4, depth));
gl_FragColor = vec4(outgoingLight, max(max(clarity, reflectance), foam));
`

/** Planar-reflection water (three.js Water) patched with depth-based color, clarity, and shore foam. */
export function buildWater(ctx: WorldCtx, c: CityLayout, sunDir: THREE.Vector3) {
  const normals = new THREE.TextureLoader().load(NORMALS)
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping
  const water = new Water(new THREE.PlaneGeometry(EXTENT, EXTENT), {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals: normals,
    sunDirection: sunDir,
    sunColor: 0xfff2dd,
    waterColor: 0x0a5878,
    distortionScale: 2.5,
    fog: true,
  })
  const mat = water.material as THREE.ShaderMaterial
  const { tex, rect } = depthTexture(c)
  Object.assign(mat.uniforms, {
    depthMap: { value: tex },
    depthRect: { value: rect },
    shallowColor: { value: new THREE.Color(0x3fd0c4) },
  })
  mat.uniforms.size.value = 1.6
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
  mat.transparent = true
  water.rotation.x = -Math.PI / 2
  water.position.set((c.land.x0 + c.land.x1) / 2, SEA_LEVEL, 0)
  water.receiveShadow = true
  ctx.scene.add(water)
  return {
    update(dt: number) {
      mat.uniforms.time.value += dt * 0.6
    },
  }
}
