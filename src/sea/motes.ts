import * as THREE from 'three'
import { SEA_LEVEL } from '../city/layout'

/*
 * Suspended specks drifting in the water, the cue that sells being under it. Each lives
 * in a world-fixed box that wraps around the camera, drawn as tiny camera-facing quads
 * (resolution independent, unlike points).
 */

const COUNT = 1400
const BOX = 22

const VERTEX = /* glsl */ `
#include <fog_pars_vertex>
attribute vec3 seed;
uniform float time;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec3 drift = vec3(0.07, 0.025, 0.05) * time + vec3(sin(time * 0.3 + seed.x * 40.0), cos(time * 0.23 + seed.z * 30.0), 0.0) * 0.06;
  vec3 cell = fract(seed + (drift - cameraPosition) / ${BOX.toFixed(1)});
  vec3 center = cameraPosition + (cell - 0.5) * ${BOX.toFixed(1)};
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float size = 0.012 + 0.03 * fract(seed.x * 13.7);
  vec3 p = center + (right * position.x + up * position.y) * size;
  vUv = position.xy;
  float d = length(center - cameraPosition);
  vAlpha = smoothstep(0.3, 1.2, d) * (1.0 - smoothstep(${(BOX * 0.3).toFixed(1)}, ${(BOX * 0.5).toFixed(1)}, d))
    * step(center.y, ${SEA_LEVEL.toFixed(2)});
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const FRAGMENT = /* glsl */ `
#include <fog_pars_fragment>
uniform vec3 color;
varying vec2 vUv;
varying float vAlpha;
void main() {
  float r = length(vUv) * 2.0;
  float a = (1.0 - smoothstep(0.3, 1.0, r)) * vAlpha * 0.55;
  if (a < 0.01) discard;
  gl_FragColor = vec4(color, a);
  #include <fog_fragment>
}
`

export function buildMotes(scene: THREE.Scene) {
  const geo = new THREE.InstancedBufferGeometry()
  geo.copy(new THREE.PlaneGeometry(1, 1) as unknown as THREE.InstancedBufferGeometry)
  const seeds = new Float32Array(COUNT * 3).map(() => Math.random())
  geo.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 3))
  geo.instanceCount = COUNT
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      time: { value: 0 },
      color: { value: new THREE.Color(0.75, 0.9, 0.85) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    fog: true,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.frustumCulled = false
  mesh.visible = false
  scene.add(mesh)
  return {
    update(below: boolean, dt: number, day: number) {
      mesh.visible = below
      material.uniforms.time.value += dt
      material.uniforms.color.value.setRGB(0.75, 0.9, 0.85).multiplyScalar(0.08 + 0.92 * day)
    },
  }
}
