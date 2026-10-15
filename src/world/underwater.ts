import * as THREE from 'three'
import { SEA_LEVEL } from '../city/layout'

// Fog hides everything past about 50 m, so the underside only has to cover the play area.
const EXTENT = 4000
const RIPPLE = 5

const VERTEX = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

// Snell's window: light from above only gets through within about 48.6 degrees of
// straight up (cos 0.66). Past that the surface mirrors the dim water below.
const FRAGMENT = /* glsl */ `
uniform sampler2D ripples;
uniform float repeat;
uniform vec2 offset;
uniform vec3 sky;
uniform vec3 mirror;
#include <fog_pars_fragment>
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  float up = normalize(vWorld - cameraPosition).y;
  float window = smoothstep(0.56, 0.74, up);
  float ripple = texture2D(ripples, vUv * repeat + offset).g;
  vec3 color = mix(mirror, sky, window) * (0.8 + 0.4 * ripple);
  gl_FragColor = vec4(color, mix(1.0, 0.85, window));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

/** Back-facing sheet material; the clone shares the normal map's image and GPU upload. */
function sheetMaterial(normals: THREE.Texture) {
  // The normal map's green channel doubles as a ripple pattern.
  const ripples = normals.clone()
  ripples.anisotropy = 8
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ripples: { value: ripples },
      repeat: { value: EXTENT / RIPPLE },
      offset: { value: new THREE.Vector2() },
      sky: { value: new THREE.Color(0xc8fff4) },
      mirror: { value: new THREE.Color(0x0b4f58) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  })
}

/**
 * The surface seen from below: three's Water is single-sided and invisible
 * from underneath, so a sheet with a bright Snell's window stands in. The
 * reflective top is hidden while the camera is under, which also skips its
 * reflection render.
 */
export function buildUnderwater(
  scene: THREE.Scene,
  surface: THREE.Object3D,
  normals: THREE.Texture,
  isWater: (x: number, z: number) => boolean,
) {
  const material = sheetMaterial(normals)
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(EXTENT, EXTENT).rotateX(-Math.PI / 2),
    material,
  )
  under.position.set(surface.position.x, SEA_LEVEL, surface.position.z)
  under.visible = false
  scene.add(under)

  return {
    get active() {
      return under.visible
    },
    update(camera: THREE.Camera, dt: number) {
      material.uniforms.offset.value.x += dt * 0.02
      const p = camera.position
      const below = p.y < SEA_LEVEL && isWater(p.x, p.z)
      surface.visible = !below
      under.visible = below
    },
  }
}
