import * as THREE from 'three'

/**
 * Static world content is grouped into square chunks so each merged or instanced
 * mesh has a tight bounding sphere and three.js can frustum-cull whole chunks.
 */
export const CHUNK = 250

export function groupByChunk<T extends { x: number; z: number }>(
  items: T[],
  size = CHUNK,
): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const key = `${Math.floor(item.x / size)},${Math.floor(item.z / size)}`
    const list = out.get(key)
    if (list) list.push(item)
    else out.set(key, [item])
  }
  return out
}

/** Terrain tile side (scenery/terrain-mesh.ts: 64 cells of 4 m); roads split along the same grid. */
export const TERRAIN_TILE = 256

/**
 * Cuts one geometry into pieces by the tile each triangle's centroid falls in, so a mesh that
 * spans the map (every road, say) becomes per-tile meshes three.js can frustum-cull.
 */
export function splitByTile(
  geo: THREE.BufferGeometry,
  size = TERRAIN_TILE,
): THREE.BufferGeometry[] {
  const flat = geo.index ? geo.toNonIndexed() : geo
  const pos = flat.attributes.position
  const buckets = new Map<string, number[]>()
  for (let t = 0; t < pos.count / 3; t++) {
    const x = (pos.getX(3 * t) + pos.getX(3 * t + 1) + pos.getX(3 * t + 2)) / 3
    const z = (pos.getZ(3 * t) + pos.getZ(3 * t + 1) + pos.getZ(3 * t + 2)) / 3
    const key = `${Math.floor(x / size)},${Math.floor(z / size)}`
    const list = buckets.get(key)
    if (list) list.push(t)
    else buckets.set(key, [t])
  }
  return [...buckets.values()].map((tris) => {
    const out = new THREE.BufferGeometry()
    for (const [name, a] of Object.entries(flat.attributes)) {
      // The slicing below reads each attribute's array as tightly packed triangles.
      if (a instanceof THREE.InterleavedBufferAttribute)
        throw new Error(`splitByTile: interleaved attribute ${name} is not supported`)
      const n = a.itemSize * 3
      const data = new (a.array.constructor as Float32ArrayConstructor)(tris.length * n)
      tris.forEach((t, k) => data.set(a.array.subarray(t * n, t * n + n), k * n))
      out.setAttribute(name, new THREE.BufferAttribute(data, a.itemSize, a.normalized))
    }
    return out
  })
}
