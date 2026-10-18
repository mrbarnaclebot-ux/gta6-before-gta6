import * as THREE from 'three'
import { reflectiveOut } from '../render/ssr'
import { PBR_METALNESS, PBR_ROUGHNESS, PBR_VERTEX } from '../world/bake-parts'

/*
 * The Blender cars come baked into one opaque mesh per level (world/bake-parts.ts): each
 * vertex carries its material. This shader repaints the `paint` parts, gives them a clear
 * coat with metal flakes, and lights the lamp parts from the car's `lamps` uniform.
 */

/** `pbr.w` codes, by the glb's material names. */
export const CAR_CODES: Record<string, number> = {
  paint: 1,
  light_head: 2,
  light_tail: 3,
  lightbar_red: 4,
  lightbar_blue: 5,
}

const VERTEX = /* glsl */ `
${PBR_VERTEX[0]}
varying vec3 vCarPos;`

const FRAGMENT = /* glsl */ `
uniform vec3 uPaint;
uniform vec4 uLamps;
varying vec4 vPbr;
varying vec3 vCarPos;
float carIs(float code) { return step(abs(vPbr.w - code), 0.5); }
vec3 carHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.103, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}`

// Lens glow: a faint daytime glow on the head and tail lamps, the rest from `uLamps`
// (x headlights, y tail and brake lights, z light bar: + red, - blue).
const GLOW = /* glsl */ `
totalEmissiveRadiance += carIs(2.0) * vec3(1.0, 0.92, 0.8) * (0.2 + uLamps.x)
  + carIs(3.0) * vec3(1.0, 0.04, 0.02) * (0.15 + uLamps.y * 0.25)
  + carIs(4.0) * vec3(1.0, 0.06, 0.03) * max(uLamps.z, 0.0)
  + carIs(5.0) * vec3(0.05, 0.25, 1.0) * max(-uLamps.z, 0.0);`

// Flakes: the paint's normal jitters per millimeter cell, so the sun glints off it.
const FLAKES = /* glsl */ `
#include <normal_fragment_maps>
normal = normalize(normal + (carHash(floor(vCarPos * 1400.0)) - 0.5) * 0.035 * carIs(1.0));`

/**
 * One car's body material: `paint` (sRGB) on its paint parts, `lamps` read every frame.
 * Every car shares one program; only the uniforms differ.
 */
export function carMaterial(paint: number, lamps: THREE.Vector4): THREE.MeshPhysicalMaterial {
  const color = new THREE.Color(paint)
  // On a light paint a mirror-sharp coat turns lamp highlights into pixel sparkles at night.
  const light = color.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    clearcoat: 1,
    clearcoatRoughness: light ? 0.16 : 0.05,
    // The sky is the whole environment map: at full strength it turned black paint navy.
    envMapIntensity: 0.7,
  })
  mat.customProgramCacheKey = () => 'car-part'
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPaint = { value: color }
    shader.uniforms.uLamps = { value: lamps }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERTEX}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${PBR_VERTEX[1]}\nvCarPos = position;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAGMENT}`)
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uPaint, carIs(1.0));',
      )
      .replace('#include <roughnessmap_fragment>', PBR_ROUGHNESS)
      .replace('#include <metalnessmap_fragment>', PBR_METALNESS)
      .replace('#include <normal_fragment_maps>', FLAKES)
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\nmaterial.clearcoat *= vPbr.z;',
      )
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${GLOW}`)
      .replace('#include <opaque_fragment>', reflectiveOut('vPbr.z * 0.35'))
  }
  return mat
}

/** The windows: dark tinted glass you can see the cabin through, shared by every car. */
export function carGlass(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x0b1014,
    roughness: 0.03,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 1.5,
  })
}
