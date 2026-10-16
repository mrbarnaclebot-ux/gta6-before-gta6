import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Clearance } from '../land/clearance'
import { CLUMP_STRIDE, GRASS_CELL, grassTile } from '../land/grass'
import type { Land } from '../land/plan'
import { KEEP_NORMAL } from '../render/card-normals'
import type { WorldCtx } from '../world/blocks'
import { DETAIL_LAYER } from '../world/instancing'
import { GrassTiles } from './grass-tiles'

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
/** Milliseconds a frame may spend building grass tiles. */
const BUDGET = 2
/** Floats per clump once baked: its instance matrix, atlas cell, and dry flag. */
const BAKED = 18
// A straw tint for dry clumps: it must stay light, as it multiplies an already dark texture.
const DRY = new THREE.Color(0xffe9a0)

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

function material(time: { value: number }, range: { value: number }): THREE.MeshLambertMaterial {
  const map = new THREE.TextureLoader().load(ATLAS)
  map.colorSpace = THREE.SRGBColorSpace
  // Lambert: diffuse only, so cards seen edge-on catch no pale sheen of sky.
  const m = new THREE.MeshLambertMaterial({
    map,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    color: new THREE.Color(0.62, 0.74, 0.48),
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

/** A tile's clumps as instance matrices, so a refill only copies numbers. */
function bake(land: Land, clear: Clearance, ti: number, tj: number): Float32Array {
  const c = grassTile(land, clear, ti, tj)
  const out = new Float32Array((c.length / CLUMP_STRIDE) * BAKED)
  const m = new THREE.Matrix4()
  const turn = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const at = new THREE.Vector3()
  const size = new THREE.Vector3()
  for (let k = 0, o = 0; k < c.length; k += CLUMP_STRIDE, o += BAKED) {
    turn.setFromAxisAngle(up, c[k + 4])
    m.compose(at.set(c[k], c[k + 1], c[k + 2]), turn, size.setScalar(c[k + 3]))
    m.toArray(out, o)
    out[o + 16] = Math.floor((c[k + 4] * 1.37) % 4)
    out[o + 17] = c[k + 5]
  }
  return out
}

/** Copies every baked clump within `radius` of (x, z) into the mesh. */
function refill(
  mesh: THREE.InstancedMesh,
  cells: Float32Array,
  tiles: GrassTiles,
  x: number,
  z: number,
  radius: number,
) {
  const mats = mesh.instanceMatrix.array as Float32Array
  const colors = mesh.instanceColor!.array as Float32Array
  const cap = cells.length
  let n = 0
  tiles.forEach(x, z, radius, (t) => {
    for (let o = 0; o < t.length && n < cap; o += BAKED) {
      if ((t[o + 12] - x) ** 2 + (t[o + 14] - z) ** 2 > radius * radius) continue
      for (let k = 0; k < 16; k++) mats[n * 16 + k] = t[o + k]
      const dry = t[o + 17] > 0
      colors[n * 3] = dry ? DRY.r : 1
      colors[n * 3 + 1] = dry ? DRY.g : 1
      colors[n * 3 + 2] = dry ? DRY.b : 1
      cells[n++] = t[o + 16]
    }
  })
  mesh.count = n
  mesh.instanceMatrix.needsUpdate = mesh.instanceColor!.needsUpdate = true
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
  const tiles = new GrassTiles((i, j) => bake(land, clear, i, j))
  const last = new THREE.Vector3(Infinity, 0, 0)
  return (eye: THREE.Vector3, reach = 1) => {
    time.value = performance.now() / 1000
    const moved = range.value !== RANGE * reach || last.distanceToSquared(eye) >= REFILL * REFILL
    range.value = RANGE * reach
    if (!tiles.fill(eye.x, eye.z, range.value, BUDGET) && !moved) return
    last.copy(eye)
    refill(mesh, cells.array as Float32Array, tiles, eye.x, eye.z, range.value)
    cells.needsUpdate = true
  }
}
