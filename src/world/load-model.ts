import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/**
 * Meshopt-compressed models arrive with quantized attributes (16-bit positions, 8-bit normals).
 * The game bakes, merges, and transforms model geometry on the CPU, which wants floats, so
 * each attribute is widened once on load. Skin indices stay integers.
 */
function widen(geo: THREE.BufferGeometry): void {
  for (const [name, a] of Object.entries(geo.attributes)) {
    if (name === 'skinIndex' || a.array instanceof Float32Array) continue
    const out = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++)
      for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k)
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize))
  }
  geo.boundingBox = geo.boundingSphere = null
}

/** The game's glTF loader: Meshopt geometry, widened to floats. */
export function modelLoader(): (url: string) => Promise<GLTF> {
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  return async (url) => {
    const model = await gltf.loadAsync(url)
    model.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) widen(mesh.geometry)
    })
    return model
  }
}
