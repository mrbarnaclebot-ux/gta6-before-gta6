import * as THREE from 'three'

const loader = new THREE.TextureLoader()

export type PbrName =
  'asphalt_02' | 'concrete_pavement_02' | 'coast_sand_01' | 'aerial_grass_rock' | 'white_stucco'

/** Every texture made from one URL, so the image downloads and uploads to the GPU once. */
const shared = new Map<string, { base: THREE.Texture; users: THREE.Texture[] }>()

function tex(url: string, repeat: number, srgb: boolean): THREE.Texture {
  let entry = shared.get(url)
  if (!entry) {
    const users: THREE.Texture[] = []
    const base = loader.load(url, () => users.forEach((u) => (u.needsUpdate = true)))
    entry = { base, users }
    shared.set(url, entry)
  }
  // Own texture for its own repeat, sharing the image source; it uploads once loaded.
  const t = new THREE.Texture()
  t.source = entry.base.source
  if (entry.base.version > 0) t.needsUpdate = true
  entry.users.push(t)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Poly Haven 1k set: color, OpenGL normal, roughness. `repeat` is tiles per UV unit. */
export function pbr(
  name: PbrName,
  repeat: number,
  extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const base = `/assets/textures/${name}/`
  return new THREE.MeshStandardMaterial({
    map: tex(base + 'diff.jpg', repeat, true),
    normalMap: tex(base + 'nor_gl.jpg', repeat, false),
    roughnessMap: tex(base + 'rough.jpg', repeat, false),
    ...extra,
  })
}
