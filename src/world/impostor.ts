import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { keepCardNormals } from '../render/card-normals'
import type { Part } from './instancing'

// Pixels per view; the texture holds two views side by side.
const VIEW_PX = 256
// Normals lean up so both faces of the cross light like a canopy, not like two flat cards.
const UP_LEAN = 1.6

/** Width over height of a 1 m tall model, from its parts' bounding box. */
function extent(parts: Part[]): number {
  const box = new THREE.Box3()
  for (const p of parts) {
    p.geometry.computeBoundingBox()
    box.union(p.geometry.boundingBox!)
  }
  return 2 * Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)
}

/** Renders the model's unlit albedo from the side, twice (0 and 90 degrees), into one texture. */
function bake(gl: THREE.WebGLRenderer, parts: Part[], width: number): THREE.Texture {
  const rt = new THREE.WebGLRenderTarget(VIEW_PX * 2, VIEW_PX, { generateMipmaps: true })
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter
  rt.texture.colorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const meshes = parts.map((p) => {
    const src = p.material as THREE.MeshStandardMaterial
    const mat = new THREE.MeshBasicMaterial({
      map: src.map,
      color: src.color,
      vertexColors: src.vertexColors,
      alphaTest: Math.max(0.5, src.alphaTest),
      side: THREE.DoubleSide,
    })
    return scene.add(new THREE.Mesh(p.geometry, mat)).children.at(-1) as THREE.Mesh
  })
  const cam = new THREE.OrthographicCamera(-width / 2, width / 2, 1, 0, -10, 10)
  const before = { target: gl.getRenderTarget(), color: gl.getClearColor(new THREE.Color()) }
  const alpha = gl.getClearAlpha()
  gl.setRenderTarget(rt)
  gl.setClearColor(0x55603a, 0)
  gl.clear()
  for (const view of [0, 1]) {
    for (const m of meshes) m.rotation.y = (view * Math.PI) / 2
    rt.viewport.set(view * VIEW_PX, 0, VIEW_PX, VIEW_PX)
    gl.setRenderTarget(rt)
    gl.render(scene, cam)
  }
  gl.setRenderTarget(before.target)
  gl.setClearColor(before.color, alpha)
  meshes.forEach((m) => (m.material as THREE.Material).dispose())
  return rt.texture
}

/** Two crossed quads, 1 m tall, each mapped to one half of the baked texture. */
function cross(width: number): THREE.BufferGeometry {
  const up = new THREE.Vector3()
  const quads = [0, 1].map((view) => {
    const q = new THREE.PlaneGeometry(width, 1).translate(0, 0.5, 0)
    const uv = q.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) + view) / 2)
    const n = q.attributes.normal as THREE.BufferAttribute
    up.set(0, UP_LEAN, 1).normalize()
    for (let i = 0; i < n.count; i++) n.setXYZ(i, up.x, up.y, up.z)
    // The second view looks along x, so its quad turns to face it.
    return q.rotateY((-view * Math.PI) / 2)
  })
  return mergeGeometries(quads)
}

/**
 * A 4-triangle stand-in for a model seen from far away: two crossed cards showing
 * pictures of it baked at load. ponytail: two fixed views and baked albedo only; an
 * octahedral impostor with normals would hold up closer, if trees ever need it.
 */
export function impostor(gl: THREE.WebGLRenderer, parts: Part[]): Part[] {
  const width = extent(parts)
  const material = keepCardNormals(
    new THREE.MeshStandardMaterial({
      map: bake(gl, parts, width),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
  )
  return [{ geometry: cross(width), material }]
}
