import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Grounded } from '../city/layout'
import type { Clearance } from '../land/clearance'
import { GRASS_CELL, grassAround } from '../land/grass'
import type { Land } from '../land/plan'
import { KEEP_NORMAL } from '../render/card-normals'
import type { WorldCtx } from '../world/blocks'
import { DETAIL_LAYER, spotMatrix } from '../world/instancing'

/*
 * Grass clumps drawn only around the camera: one instanced mesh refilled as the camera
 * moves, swaying in the wind and shrinking into the ground toward the edge of its range.
 * The clump pictures are four cells of Poly Haven's grass_medium_01 texture.
 */

const ATLAS = '/assets/textures/grass_clumps.webp'
/** Meters at reach 1 (the render distance's plant reach scales it). */
const RANGE = 42
// Refill once the camera has moved this far: the fade hides clumps appearing at the edge.
const REFILL = 3

/** Three crossed cards, 2 m wide and 1 m tall (the atlas cells are 2:1), normals leaning up. */
function clump(): THREE.BufferGeometry {
  const cards = [0, 1, 2].map((k) => {
    const q = new THREE.PlaneGeometry(2, 1).translate(0, 0.5, 0).rotateY((k * Math.PI) / 3)
    const n = q.attributes.normal as THREE.BufferAttribute
    for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.35, 0.94, n.getZ(i) * 0.35)
    return q
  })
  return mergeGeometries(cards)
}

const VERTEX = /* glsl */ `
attribute float cell;
uniform float time;
uniform float range;
`
/** Picks the atlas cell, bends the tips in the wind, and sinks clumps near the range edge. */
const BEGIN = /* glsl */ `
#include <begin_vertex>
vec3 root = instanceMatrix[3].xyz;
float tip = uv.y * uv.y;
float gust = sin(time * 1.7 + root.x * 0.31 + root.z * 0.23) + 0.5 * sin(time * 3.1 + root.x * 0.7);
transformed.xz += vec2(0.09, 0.05) * gust * tip;
float far = distance(root, cameraPosition);
transformed.y *= 1.0 - smoothstep(range * 0.7, range, far);
`
const UV = /* glsl */ `
#include <uv_vertex>
vMapUv = vec2(uv.x * 0.5 + mod(cell, 2.0) * 0.5, uv.y * 0.5 + (cell < 2.0 ? 0.5 : 0.0));
`

function material(time: { value: number }, range: { value: number }): THREE.MeshStandardMaterial {
  const map = new THREE.TextureLoader().load(ATLAS)
  map.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.9,
    color: new THREE.Color(0.78, 0.86, 0.66),
  })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { time, range })
    shader.vertexShader = (VERTEX + shader.vertexShader)
      .replace('#include <begin_vertex>', BEGIN)
      .replace('#include <uv_vertex>', UV)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      KEEP_NORMAL,
    )
  }
  return m
}

/** Grass around the camera. Returns the per-frame update. */
export function plantGrass(ctx: WorldCtx, land: Land, clear: Clearance) {
  const time = { value: 0 }
  const range = { value: RANGE }
  const cap = Math.ceil((Math.PI * (RANGE * 1.5) ** 2) / GRASS_CELL ** 2)
  const mesh = new THREE.InstancedMesh(clump(), material(time, range), cap)
  const cells = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1)
  mesh.geometry.setAttribute('cell', cells)
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
  mesh.frustumCulled = false
  mesh.receiveShadow = true
  mesh.layers.set(DETAIL_LAYER)
  ctx.scene.add(mesh)
  const spots: Grounded[] = []
  const last = new THREE.Vector3(Infinity, 0, 0)
  const tmp = new THREE.Matrix4()
  const color = new THREE.Color()
  return (eye: THREE.Vector3, reach = 1) => {
    time.value = performance.now() / 1000
    range.value = RANGE * reach
    if (last.distanceToSquared(eye) < REFILL * REFILL) return
    last.copy(eye)
    grassAround(land, clear, eye.x, eye.z, range.value, spots)
    mesh.count = Math.min(cap, spots.length)
    for (let i = 0; i < mesh.count; i++) {
      const s = spots[i]
      mesh.setMatrixAt(i, spotMatrix(s, s.s, tmp))
      mesh.setColorAt(i, color.setHex(s.tint ?? 0xffffff))
      cells.setX(i, Math.floor((s.r * 1.37) % 4))
    }
    mesh.instanceMatrix.needsUpdate = cells.needsUpdate = true
    mesh.instanceColor!.needsUpdate = true
  }
}
