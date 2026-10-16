import * as THREE from 'three'
import { SEA_LEVEL } from '../city/layout'
import type { Ambient } from '../render/sky'
import { buildMotes } from '../sea/motes'
import { SEA_PARS, type SeaUniforms } from '../sea/sea-glsl'
import { gridAnchor } from '../sea/sea-grid'
import { buildShafts } from '../sea/shafts'

const ZENITH = new THREE.Color(0.55, 0.85, 1.0)
const HORIZON = new THREE.Color(0.85, 1.0, 0.98)
const MIRROR = new THREE.Color(0x0b4f58)

const VERTEX = /* glsl */ `
${SEA_PARS}
#include <fog_pars_vertex>
varying vec3 vWorld;
varying vec3 vWaveN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 n;
  wp.xyz += seaDisplace(wp.xz, seaTime, length(wp.xz - cameraPosition.xz), n);
  vWorld = wp.xyz;
  vWaveN = n;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

// Snell's window: light from above only gets through within about 48.6 degrees of straight
// up. The view ray is refracted through the rippled surface into the sky; past the window
// the surface mirrors the dim water below (total internal reflection).
const FRAGMENT = /* glsl */ `
uniform sampler2D ripples;
uniform float seaTime;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 mirror;
uniform vec3 sunDir;
uniform vec3 sunColor;
#include <fog_pars_fragment>
varying vec3 vWorld;
varying vec3 vWaveN;
void main() {
  vec3 v = normalize(vWorld - cameraPosition);
  vec2 r = texture2D(ripples, vWorld.xz * 0.21 + seaTime * vec2(0.021, 0.013)).rg * 2.0 - 1.0;
  r += texture2D(ripples, vWorld.xz * 0.07 - seaTime * vec2(0.011, -0.017)).rg * 2.0 - 1.0;
  vec3 n = normalize(normalize(vWaveN) + vec3(r.x, 0.0, r.y) * 0.18);
  float cosi = dot(v, n);
  float k = 1.0 - 1.777 * (1.0 - cosi * cosi);
  float window = smoothstep(0.0, 0.12, k);
  vec3 t = k > 0.0 ? refract(v, -n, 1.333) : vec3(0.0, 1.0, 0.0);
  float sun = max(dot(t, sunDir), 0.0);
  vec3 sky = mix(horizon, zenith, smoothstep(0.0, 0.7, t.y));
  sky += sunColor * (pow(sun, 400.0) * 30.0 + pow(sun, 16.0) * 1.2);
  // The window's rim is bright: grazing light reflects there, then the mirror takes over.
  sky *= 0.6 + 0.4 * smoothstep(0.0, 0.5, k);
  vec3 below = mirror * (0.75 + 0.5 * (r.x * 0.5 + 0.5));
  vec3 color = mix(below, sky, window);
  gl_FragColor = vec4(color, mix(1.0, 0.85, window));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

/** Back-facing sheet material; the clone shares the normal map's image and GPU upload. */
function sheetMaterial(normals: THREE.Texture, sea: SeaUniforms, light: Ambient) {
  // The normal map's red and green double as a ripple pattern.
  const ripples = normals.clone()
  ripples.anisotropy = 8
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...sea,
      ripples: { value: ripples },
      zenith: { value: ZENITH.clone() },
      horizon: { value: HORIZON.clone() },
      mirror: { value: MIRROR.clone() },
      sunDir: { value: light.sunDir },
      sunColor: { value: new THREE.Color() },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  })
}

/** Dims the sky and water colors toward night. */
function tint(m: THREE.ShaderMaterial, light: Ambient, day: number): void {
  const k = 0.06 + 0.94 * day
  const u = m.uniforms
  u.zenith.value.copy(ZENITH).multiplyScalar(k)
  u.horizon.value.copy(HORIZON).multiplyScalar(k)
  u.mirror.value.copy(MIRROR).multiplyScalar(k)
  u.sunColor.value.copy(light.sunColor).multiplyScalar(day)
}

interface UnderwaterDeps {
  scene: THREE.Scene
  surface: THREE.Object3D
  normals: THREE.Texture
  grid: THREE.BufferGeometry
  sea: SeaUniforms
  light: Ambient
  /** Water surface height at (x, z), waves included, or null on land. */
  water: (x: number, z: number) => number | null
}

/**
 * The surface seen from below: three's Water is single-sided and invisible from underneath,
 * so a wave sheet with a refracted Snell's window stands in, plus light shafts and drifting
 * motes. The reflective top is hidden while the camera is under, which skips its mirror too.
 */
export function buildUnderwater(d: UnderwaterDeps) {
  const material = sheetMaterial(d.normals, d.sea, d.light)
  const under = new THREE.Mesh(d.grid, material)
  under.rotation.x = -Math.PI / 2
  under.frustumCulled = false
  under.visible = false
  d.scene.add(under)
  const shafts = buildShafts(d.scene, d.light)
  const motes = buildMotes(d.scene)
  const anchor = new THREE.Vector3()
  let depth = 0
  return {
    get active() {
      return under.visible
    },
    /** How far the camera is under the surface, 0 above it. */
    get depth() {
      return depth
    },
    /** `day` dims the sheet at night, from 1 at full daylight to 0. */
    update(camera: THREE.Camera, dt: number, day: number) {
      tint(material, d.light, day)
      const p = camera.position
      const top = d.water(p.x, p.z)
      depth = top === null ? 0 : Math.max(0, top - p.y)
      const below = depth > 0
      d.surface.visible = !below
      under.visible = below
      gridAnchor(p.x, p.z, anchor)
      under.position.set(anchor.x, SEA_LEVEL, anchor.z)
      shafts.update(camera, below, depth, dt)
      motes.update(below, dt, day)
    },
  }
}
