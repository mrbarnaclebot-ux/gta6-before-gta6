// Rebuilds the `bark` and `lite` trunks of a forest tree from its Poly Haven scan:
//   node scripts/bark-lod.mjs <polyhaven id> <glb in assets-src/models/vegetation> <bark tris> <lite tris>
// e.g. node scripts/bark-lod.mjs island_tree_01 island_tree_01 3000 900
// The scan is fetched once into assets-src/.polyhaven (git-ignored: tens of MB per tree).
// Plain position-only simplification flattened thin limbs into two-sided ribbons ("bark shards").
// Weighting the normals keeps a limb round until it is dropped whole, and Prune removes the
// small twig islands the leaf cards hide anyway. The foliage cards in the glb are left alone.
// Then run `node scripts/compress-assets.mjs models`.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune } from '@gltf-transform/functions'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MeshoptSimplifier } from 'meshoptimizer'

const [id, file, barkTris, liteTris] = process.argv.slice(2)
const CACHE = 'assets-src/.polyhaven'
const PH = 'https://dl.polyhaven.org/file/ph-assets/Models/gltf'
// How much a normal's change counts against a collapse, next to the position error.
const NORMAL_WEIGHT = 0.6
const UV_WEIGHT = 0.05
// Largest error a level may reach, relative to the tree's size: Prune drops twig islands smaller
// than this, so it bounds what goes missing as well as the shape change.
const MAX_ERROR = { bark: 0.02, lite: 0.06 }

async function fetchOnce(url, path) {
  if (existsSync(path)) return readFileSync(path)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(path, buf)
  return buf
}

/** The scan's trunk primitive (the one whose material is named after the tree or `_trunk`). */
async function scanTrunk() {
  mkdirSync(CACHE, { recursive: true })
  const json = JSON.parse(
    await fetchOnce(`${PH}/1k/${id}/${id}_1k.gltf`, join(CACHE, `${id}.gltf`)),
  )
  const bin = await fetchOnce(`${PH}/8k/${id}/${json.buffers[0].uri}`, join(CACHE, `${id}.bin`))
  const read = (i, Type) => {
    const a = json.accessors[i]
    const v = json.bufferViews[a.bufferView]
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type] * a.count
    const at = bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0)
    return new Type(bin.buffer.slice(at, at + n * Type.BYTES_PER_ELEMENT))
  }
  const prim = json.meshes[0].primitives.find((p) => {
    const name = json.materials[p.material].name
    return name === id || name.endsWith('_trunk')
  })
  const index = json.accessors[prim.indices].componentType === 5125 ? Uint32Array : Uint16Array
  return welded({
    position: read(prim.attributes.POSITION, Float32Array),
    normal: read(prim.attributes.NORMAL, Float32Array),
    uv: read(prim.attributes.TEXCOORD_0, Float32Array),
    indices: Uint32Array.from(read(prim.indices, index)),
  })
}

/**
 * Merges vertices that share a position and UV, averaging their normals. Some scans split
 * every vertex by face normal, and the simplifier cannot collapse anything across such splits.
 */
function welded({ position, normal, uv, indices }) {
  const first = new Map()
  const remap = new Uint32Array(position.length / 3)
  const keep = []
  for (let i = 0; i < remap.length; i++) {
    const key = [...position.subarray(i * 3, i * 3 + 3), ...uv.subarray(i * 2, i * 2 + 2)].join()
    if (!first.has(key)) first.set(key, keep.push(i) - 1)
    remap[i] = first.get(key)
  }
  const n = new Float32Array(keep.length * 3)
  remap.forEach((to, from) => {
    for (let k = 0; k < 3; k++) n[to * 3 + k] += normal[from * 3 + k]
  })
  for (let i = 0; i < keep.length; i++) {
    const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]) || 1
    for (let k = 0; k < 3; k++) n[i * 3 + k] /= l
  }
  const gather = (src, k) => {
    const dst = new Float32Array(keep.length * k)
    keep.forEach((from, to) => dst.set(src.subarray(from * k, from * k + k), to * k))
    return dst
  }
  return {
    position: gather(position, 3),
    normal: n,
    uv: gather(uv, 2),
    indices: indices.map((i) => remap[i]),
  }
}

function simplified(mesh, tris, maxError) {
  const { position, normal, uv, indices } = mesh
  const n = position.length / 3
  const attrs = new Float32Array(n * 5)
  for (let i = 0; i < n; i++)
    attrs.set([...normal.subarray(i * 3, i * 3 + 3), ...uv.subarray(i * 2, i * 2 + 2)], i * 5)
  const weights = [NORMAL_WEIGHT, NORMAL_WEIGHT, NORMAL_WEIGHT, UV_WEIGHT, UV_WEIGHT]
  const [out, error] = MeshoptSimplifier.simplifyWithAttributes(
    indices,
    position,
    3,
    attrs,
    5,
    weights,
    null,
    tris * 3,
    maxError,
    ['Prune', 'Permissive'],
  )
  const [remap, count] = MeshoptSimplifier.compactMesh(out)
  const pick = (src, k) => {
    const dst = new Float32Array(count * k)
    remap.forEach(
      (to, from) => to !== 0xffffffff && dst.set(src.subarray(from * k, from * k + k), to * k),
    )
    return dst
  }
  console.log(
    `${id}: ${indices.length / 3} -> ${out.length / 3} triangles, error ${error.toFixed(4)}`,
  )
  return { position: pick(position, 3), normal: pick(normal, 3), uv: pick(uv, 2), indices: out }
}

/** Swaps the trunk primitive under `node` for `mesh`, keeping its material. */
function replace(doc, node, mesh) {
  const prim = doc
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === node)
    .listChildren()[0]
    .getMesh()
    .listPrimitives()[0]
  const buffer = doc.getRoot().listBuffers()[0]
  const acc = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer)
  prim.setAttribute('POSITION', acc(mesh.position, 'VEC3'))
  prim.setAttribute('NORMAL', acc(mesh.normal, 'VEC3'))
  prim.setAttribute('TEXCOORD_0', acc(mesh.uv, 'VEC2'))
  prim.setIndices(acc(mesh.indices, 'SCALAR'))
  // Some trunks carry a plain white vertex color: keep it, at the new vertex count.
  if (prim.getAttribute('COLOR_0')) {
    const white = new Uint8Array((mesh.position.length / 3) * 4).fill(255)
    prim.setAttribute('COLOR_0', acc(white, 'VEC4').setNormalized(true))
  }
}

await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const path = join('assets-src/models/vegetation', `${file}.glb`)
const doc = await io.read(path)
const trunk = await scanTrunk()
replace(doc, 'bark', simplified(trunk, +barkTris, MAX_ERROR.bark))
replace(doc, 'lite', simplified(trunk, +liteTris, MAX_ERROR.lite))
await doc.transform(prune({ propertyTypes: ['Accessor'] }))
await io.write(path, doc)
