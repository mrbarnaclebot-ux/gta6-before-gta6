import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CAUSTICS, SEA_TIME_GLSL, underwaterLight } from './caustics'

/*
 * A small procedural fish, 1 m from nose (+z) to tail fin (-z), flattened sideways, with
 * a dark back and a silver belly in vertex colors. The tail beats in the vertex shader.
 */

// Body half-height along its length, nose to tail root.
const PROFILE: [z: number, r: number][] = [
  [0.4, 0],
  [0.36, 0.07],
  [0.25, 0.13],
  [0.05, 0.15],
  [-0.15, 0.11],
  [-0.3, 0.05],
  [-0.36, 0.035],
]

function body(): THREE.BufferGeometry {
  // Tail first, so the lathe's normals face out; the lathe's y becomes the fish's z.
  const pts = PROFILE.map(([z, r]) => new THREE.Vector2(r, z)).reverse()
  // Lathe around y, then lay the axis along z and squash it to a fish's narrow width.
  const g = new THREE.LatheGeometry(pts, 10).rotateX(Math.PI / 2)
  g.scale(0.42, 1, 1)
  return g
}

function fin(points: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  g.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(new Array((points.length / 3) * 2).fill(0), 2),
  )
  g.computeVertexNormals()
  return g
}

function paint(g: THREE.BufferGeometry): void {
  const pos = g.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const back = new THREE.Color(0.16, 0.24, 0.3)
  const belly = new THREE.Color(0.92, 0.94, 0.95)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    c.copy(belly).lerp(back, THREE.MathUtils.smoothstep(pos.getY(i), -0.04, 0.09))
    c.toArray(colors, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

export function fishGeometry(): THREE.BufferGeometry {
  const parts = [
    body(),
    // Forked tail fin, then the dorsal fin.
    fin([
      0, 0, -0.33, 0, 0.17, -0.52, 0, 0.02, -0.44, 0, 0, -0.33, 0, -0.02, -0.44, 0, -0.15, -0.52,
    ]),
    fin([0, 0.13, 0.08, 0, 0.21, -0.08, 0, 0.1, -0.16]),
  ].map((g) => g.toNonIndexed())
  parts.forEach((g) => g.deleteAttribute('normal'))
  const merged = mergeGeometries(parts)
  merged.computeVertexNormals()
  paint(merged)
  return merged
}

const SWIM = /* glsl */ `
#include <begin_vertex>
{
  // The rear two thirds sway, more toward the tail; each fish beats out of step.
  float tail = smoothstep(0.15, -0.5, transformed.z);
  float phase = float(gl_InstanceID) * 1.618;
  transformed.x += sin(transformed.z * 7.0 - seaTime * 11.0 + phase) * 0.09 * tail;
}
`

/** Shiny, scaled fish material that swims; tinted per instance by species. */
export function fishMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.35,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.seaTime = CAUSTICS.seaTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + SEA_TIME_GLSL)
      .replace('#include <begin_vertex>', SWIM)
  }
  m.customProgramCacheKey = () => 'fish'
  return underwaterLight(m)
}
