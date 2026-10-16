import * as THREE from 'three'
import { adopt, ktx2 } from '../render/ktx2'

export type PbrName =
  'asphalt_02' | 'concrete_pavement_02' | 'coast_sand_01' | 'aerial_grass_rock' | 'white_stucco'

interface Shared {
  base: THREE.CompressedTexture | null
  users: THREE.Texture[]
}

/** Every texture made from one URL, so the file downloads and uploads to the GPU once. */
const shared = new Map<string, Shared>()

/** A repeating KTX2 texture; its color space comes from the file. */
export function tex(url: string, repeat: number): THREE.Texture {
  let entry = shared.get(url)
  if (!entry) {
    const e: Shared = { base: null, users: [] }
    ktx2().load(url, (loaded) => {
      e.base = loaded
      e.users.forEach((u) => adopt(u, loaded))
    })
    entry = e
    shared.set(url, entry)
  }
  // Own texture for its own repeat, sharing the GPU copy; it uploads once loaded.
  const t = new THREE.CompressedTexture([], 0, 0)
  if (entry.base) adopt(t, entry.base)
  entry.users.push(t)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 8
  return t
}

/** Poly Haven 1k set as KTX2 (scripts/compress-assets.mjs): color, OpenGL normal, roughness. `repeat` is tiles per UV unit. */
export function pbr(
  name: PbrName,
  repeat: number,
  extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const base = `/assets/textures/${name}/`
  return new THREE.MeshStandardMaterial({
    map: tex(base + 'diff.ktx2', repeat),
    normalMap: tex(base + 'nor_gl.ktx2', repeat),
    roughnessMap: tex(base + 'rough.ktx2', repeat),
    ...extra,
  })
}
