import * as THREE from 'three'
import { SEA_LEVEL } from '../city/layout'
import type { Ambient } from '../render/sky'

/*
 * Underwater god rays: soft additive ribbons hanging from the surface along the refracted
 * sun direction, each turned to face the camera around its own axis. They sit on a
 * world-fixed lattice around the camera, so swimming past them reads as parallax.
 */

const CELL = 5
const RINGS = 5
const MAX = (RINGS * 2 + 1) ** 2
const LENGTH = 22

const VERTEX = /* glsl */ `
uniform vec3 axis;
uniform float time;
varying vec2 vUv;
varying float vFade;
varying float vPulse;
void main() {
  vec3 top = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float width = length(instanceMatrix[0].xyz);
  vec3 side = normalize(cross(axis, top - cameraPosition));
  vec3 p = top + axis * position.y * ${LENGTH.toFixed(1)} + side * position.x * width;
  vUv = vec2(position.x + 0.5, position.y);
  float d = length(p - cameraPosition);
  vFade = smoothstep(1.5, 5.0, d) * exp(-d * 0.06);
  float id = float(gl_InstanceID);
  vPulse = 0.55 + 0.45 * sin(time * (0.4 + fract(id * 0.37) * 0.5) + id * 2.3);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform vec3 color;
varying vec2 vUv;
varying float vFade;
varying float vPulse;
void main() {
  float across = sin(vUv.x * 3.14159);
  float along = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.04, vUv.y);
  gl_FragColor = vec4(color * across * across * along * vFade * vPulse, 1.0);
}
`

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function buildShafts(scene: THREE.Scene, light: Ambient) {
  const uniforms = {
    axis: { value: new THREE.Vector3(0, -1, 0) },
    time: { value: 0 },
    color: { value: new THREE.Color() },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  const quad = new THREE.PlaneGeometry(1, 1, 1, 8).translate(0, 0.5, 0)
  const mesh = new THREE.InstancedMesh(quad, material, MAX)
  mesh.frustumCulled = false
  mesh.visible = false
  scene.add(mesh)
  const m = new THREE.Matrix4()
  const down = new THREE.Vector3()
  return {
    update(camera: THREE.Camera, below: boolean, depth: number, dt: number) {
      const sunUp = Math.max(0, light.sunDir.y)
      mesh.visible = below && sunUp > 0.05
      if (!mesh.visible) return
      uniforms.time.value += dt
      refractDown(down.copy(light.sunDir).negate(), uniforms.axis.value)
      const gain = 0.13 * Math.min(1, sunUp * 2.5) * Math.exp(-depth * 0.05)
      uniforms.color.value.copy(light.sunColor).multiplyScalar(gain).multiply(TINT)
      place(mesh, camera.position, m)
    },
  }
}

const TINT = new THREE.Color(0.75, 1.0, 0.95)
const ETA = 1 / 1.333

/** Sunlight bends toward straight down as it enters the water (Snell's law, flat surface). */
function refractDown(i: THREE.Vector3, out: THREE.Vector3): void {
  const cos = i.y
  const k = 1 - ETA * ETA * (1 - cos * cos)
  out.copy(i).multiplyScalar(ETA)
  out.y -= ETA * cos + Math.sqrt(k)
  out.normalize()
}

/** Shafts on the hashed lattice cells around the camera, about two in five lit. */
function place(mesh: THREE.InstancedMesh, eye: THREE.Vector3, m: THREE.Matrix4) {
  const cx = Math.floor(eye.x / CELL)
  const cz = Math.floor(eye.z / CELL)
  let n = 0
  for (let i = -RINGS; i <= RINGS; i++) {
    for (let j = -RINGS; j <= RINGS; j++) {
      const h = hash(cx + i, cz + j)
      if (h > 0.42) continue
      const x = (cx + i + hash(cx + i, cz + j + 7)) * CELL
      const z = (cz + j + hash(cx + i + 3, cz + j)) * CELL
      const width = 0.8 + 3 * hash(cx + i + 11, cz + j + 5)
      m.makeScale(width, 1, 1).setPosition(x, SEA_LEVEL, z)
      mesh.setMatrixAt(n++, m)
    }
  }
  mesh.count = n
  mesh.instanceMatrix.needsUpdate = true
}
