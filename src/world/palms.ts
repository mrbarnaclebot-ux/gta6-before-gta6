import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RAPIER } from '../physics'
import type { WorldCtx } from './blocks'

const URLS = [1, 2, 3, 4].map((i) => `/assets/models/vegetation/PalmTree_${i}.glb`)

/** Quaternius palms ship tiny, Z-up, and slightly metallic; normalize them to real palms. */
function prepare(gltf: GLTF): THREE.Object3D {
  const root = gltf.scene
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = mesh.receiveShadow = true
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.metalness = 0
    mat.roughness = 0.8
  })
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
  root.scale.setScalar(1 / size.y)
  return root
}

/** Places palms at [x, z, height] spots, each with a trunk collider. */
export async function plantPalms(
  ctx: WorldCtx,
  load: (url: string) => Promise<GLTF>,
  spots: [number, number, number][],
): Promise<void> {
  const models = (await Promise.all(URLS.map(load))).map(prepare)
  spots.forEach(([x, z, height], i) => {
    const palm = models[i % models.length].clone()
    palm.scale.multiplyScalar(height)
    palm.position.set(x, 0, z)
    palm.rotation.y = i * 2.4
    ctx.scene.add(palm)
    const trunk = RAPIER.ColliderDesc.cylinder(2, 0.25).setTranslation(x, 2, z)
    ctx.physics.createCollider(trunk)
  })
}
