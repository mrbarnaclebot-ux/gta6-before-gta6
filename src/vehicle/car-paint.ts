import * as THREE from 'three'
import { HSV_GLSL } from '../render/hsv-glsl'

/*
 * The generated car bodies are one textured mesh each: paint, glass, trim, and lamps
 * all live in a single baked color map. This shader repaints the colorful parts (gray
 * trim and glass have no hue to turn) and finds the lamps by color and position in the
 * model's own space, so they can light up without separate lamp meshes.
 */

/** Hue turn (0 to 1), saturation and value scale, applied only to already colorful pixels. */
export type Paint = [hue: number, saturation: number, value: number]

const VERTEX = /* glsl */ `
varying vec3 vCarPos;`

const FRAGMENT = /* glsl */ `
uniform vec3 uPaint;
uniform vec4 uLamps;
varying vec3 vCarPos;
${HSV_GLSL}`

// Classified in gamma space (sqrt is close enough), where hues read as they look.
// Lamp masks also use model units: the body spans -0.5..0.5 along z, nose at +z.
const LAMPS = /* glsl */ `
  vec3 carSrc = diffuseColor.rgb;
  vec3 hsv = rgb2hsv(sqrt(carSrc));
  float colorful = smoothstep(0.25, 0.5, hsv.y);
  vec3 painted = hsv2rgb(vec3(fract(hsv.x + uPaint.x), min(1.0, hsv.y * uPaint.y), hsv.z * uPaint.z));
  diffuseColor.rgb = mix(carSrc, painted * painted, colorful);
  float isRed = step(0.55, hsv.y) * step(0.15, hsv.z) * max(step(hsv.x, 0.035), step(0.97, hsv.x));
  float isBlue = step(0.4, hsv.y) * step(0.2, hsv.z) * step(0.55, hsv.x) * step(hsv.x, 0.75);
  float isWhite = step(hsv.y, 0.2) * smoothstep(0.6, 0.8, hsv.z);
  float roof = step(uLamps.w, vCarPos.y);
  vec3 red = vec3(1.0, 0.06, 0.03);
  vec3 carGlow = carSrc * isWhite * step(0.41, vCarPos.z) * uLamps.x
    + red * isRed * step(vCarPos.z, -0.42) * uLamps.y * 0.25
    + roof * (isRed * red * max(uLamps.z, 0.0) + isBlue * vec3(0.05, 0.25, 1.0) * max(-uLamps.z, 0.0));`

/**
 * A copy of the body material that repaints and lights its lamps. `lamps`: x headlights,
 * y brake lights, z light bar (+1 red, -1 blue, 0 off), w the light bar's lowest y in model units.
 */
export function carBodyMaterial(
  base: THREE.MeshStandardMaterial,
  paint: Paint,
  lamps: THREE.Vector4,
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial()
  THREE.MeshStandardMaterial.prototype.copy.call(mat, base)
  // The standard copy resets the defines, which would compile out the clear coat.
  mat.defines = { STANDARD: '', PHYSICAL: '' }
  // A clear coat gives the paint and glass a second, sharp sky reflection.
  mat.clearcoat = 0.7
  mat.clearcoatRoughness = 0.08
  mat.customProgramCacheKey = () => 'car-body'
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPaint = { value: new THREE.Vector3(...paint) }
    shader.uniforms.uLamps = { value: lamps }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERTEX}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vCarPos = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAGMENT}`)
      .replace('#include <map_fragment>', `#include <map_fragment>${LAMPS}`)
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  totalEmissiveRadiance += carGlow;',
      )
  }
  return mat
}
