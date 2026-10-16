import * as THREE from 'three'
import { rng } from '../city/rng'
import type { Clearance } from '../land/clearance'
import { LAWN_CELL, lawnTile, PATCH_STRIDE } from '../land/lawn'
import type { Land } from '../land/plan'
import { KEEP_NORMAL } from '../render/card-normals'
import type { WorldCtx } from '../world/blocks'
import { DETAIL_LAYER } from '../world/instancing'
import { GrassTiles } from './grass-tiles'

/*
 * A lawn of real blades (three vertices each, no alpha test, no overdraw) on every grassy
 * patch around the camera: one instanced mesh refilled as the camera moves, like the clumps
 * in grass.ts. Blades bend in the wind and sink into the ground toward the edge of range,
 * where the terrain's own grass color (terrain-material.ts) carries the green on.
 */

/** Meters at reach 1 (the render distance's plant reach scales it). */
const RANGE = 17
const REFILL = 2
const BUDGET = 1.5
const BLADES = 170
/** Floats per baked patch: its instance matrix and its tint. */
const BAKED = 19
// Base, tip, and a dry straw tip, linear: the base sits in the blades' own shade.
const BASE = new THREE.Color(0.012, 0.022, 0.005)
const TIP = new THREE.Color(0.05, 0.09, 0.016)
const STRAW = new THREE.Color(0.15, 0.13, 0.045)

/** One patch: BLADES blades scattered over a cell, 1 m tall before the per-patch scale. */
function patch(): THREE.BufferGeometry {
  const r = rng(1234)
  const pos: number[] = []
  const col: number[] = []
  const tip: number[] = []
  const c = new THREE.Color()
  for (let i = 0; i < BLADES; i++) {
    const [x, z] = [(r() - 0.5) * LAWN_CELL * 1.25, (r() - 0.5) * LAWN_CELL * 1.25]
    const a = r() * Math.PI
    const w = 0.016 + r() * 0.014
    const [dx, dz] = [Math.cos(a) * w, Math.sin(a) * w]
    const h = 0.12 + r() * 0.2
    const lean = (r() - 0.5) * 0.18
    pos.push(
      x - dx,
      0,
      z - dz,
      x + dx,
      0,
      z + dz,
      x + lean * Math.sin(a + 1),
      h,
      z + lean * Math.cos(a + 1),
    )
    const top = c.copy(TIP).lerp(STRAW, r() < 0.12 ? 0.6 : r() * 0.2)
    col.push(...BASE.toArray(), ...BASE.toArray(), ...top.toArray())
    tip.push(0, 0, 1)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  // Blades lit like the ground they grow from: normals straight up, whichever side faces you.
  geo.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(
      pos.map((_, i) => +(i % 3 === 1)),
      3,
    ),
  )
  geo.setAttribute('tip', new THREE.Float32BufferAttribute(tip, 1))
  return geo
}

const VERTEX = /* glsl */ `
attribute float tip;
uniform float time;
uniform float range;
`
const BEGIN = /* glsl */ `
#include <begin_vertex>
vec3 root = instanceMatrix[3].xyz;
float gust = sin(time * 1.9 + root.x * 0.37 + root.z * 0.29) + 0.6 * sin(time * 3.3 + root.z * 0.8);
transformed.xz += vec2(0.06, 0.035) * gust * tip;
transformed.y *= 1.0 - smoothstep(range * 0.6, range, distance(root, cameraPosition));
`

function material(time: { value: number }, range: { value: number }): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { time, range })
    shader.vertexShader = (VERTEX + shader.vertexShader).replace('#include <begin_vertex>', BEGIN)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      KEEP_NORMAL,
    )
  }
  m.customProgramCacheKey = () => 'lawn'
  return m
}

const UP = new THREE.Vector3(0, 1, 0)

/** A tile's patches as instance matrices and tints, so a refill only copies numbers. */
function bake(land: Land, clear: Clearance, ti: number, tj: number): Float32Array {
  const c = lawnTile(land, clear, ti, tj)
  const out = new Float32Array((c.length / PATCH_STRIDE) * BAKED)
  const m = new THREE.Matrix4()
  const turn = new THREE.Quaternion()
  const tilt = new THREE.Quaternion()
  const n = new THREE.Vector3()
  const at = new THREE.Vector3()
  const size = new THREE.Vector3()
  const tint = new THREE.Color()
  for (let k = 0, o = 0; k < c.length; k += PATCH_STRIDE, o += BAKED) {
    n.set(c[k + 4], 0, c[k + 5])
    n.y = Math.sqrt(Math.max(0, 1 - n.x * n.x - n.z * n.z))
    turn.setFromAxisAngle(UP, c[k + 3]).premultiply(tilt.setFromUnitVectors(UP, n))
    m.compose(at.set(c[k], c[k + 1], c[k + 2]), turn, size.set(1, c[k + 6], 1))
    m.toArray(out, o)
    tint
      .setRGB(1, 1, 1)
      .lerp(STRAW_TINT, Math.min(1, c[k + 7]))
      .toArray(out, o + 16)
  }
  return out
}

// Dry patches turn the whole patch toward straw, matching the terrain's dry grass.
const STRAW_TINT = new THREE.Color(1.5, 1.2, 0.75)

function refill(mesh: THREE.InstancedMesh, tiles: GrassTiles, x: number, z: number, r: number) {
  const mats = mesh.instanceMatrix.array as Float32Array
  const colors = mesh.instanceColor!.array as Float32Array
  const cap = mesh.instanceMatrix.count
  let n = 0
  tiles.forEach(x, z, r, (t) => {
    for (let o = 0; o < t.length && n < cap; o += BAKED) {
      if ((t[o + 12] - x) ** 2 + (t[o + 14] - z) ** 2 > r * r) continue
      mats.set(t.subarray(o, o + 16), n * 16)
      colors.set(t.subarray(o + 16, o + 19), n * 3)
      n++
    }
  })
  mesh.count = n
  mesh.instanceMatrix.needsUpdate = mesh.instanceColor!.needsUpdate = true
}

/** The lawn around the camera. Returns the per-frame update. */
export function plantLawn(ctx: WorldCtx, land: Land, clear: Clearance) {
  const time = { value: 0 }
  const range = { value: RANGE }
  const cap = Math.ceil((Math.PI * (RANGE * 1.5) ** 2) / LAWN_CELL ** 2)
  const mesh = new THREE.InstancedMesh(patch(), material(time, range), cap)
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
  mesh.frustumCulled = false
  mesh.receiveShadow = true
  mesh.layers.set(DETAIL_LAYER)
  mesh.count = 0
  ctx.scene.add(mesh)
  const tiles = new GrassTiles((i, j) => bake(land, clear, i, j))
  const last = new THREE.Vector3(Infinity, 0, 0)
  return (eye: THREE.Vector3, reach = 1) => {
    time.value = performance.now() / 1000
    const moved = range.value !== RANGE * reach || last.distanceToSquared(eye) >= REFILL * REFILL
    range.value = RANGE * reach
    if (!tiles.fill(eye.x, eye.z, range.value, BUDGET) && !moved) return
    last.copy(eye)
    refill(mesh, tiles, eye.x, eye.z, range.value)
  }
}
