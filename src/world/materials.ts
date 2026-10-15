import * as THREE from 'three'

const loader = new THREE.TextureLoader()

export type PbrName =
  | 'asphalt_02'
  | 'concrete_pavement_02'
  | 'coast_sand_01'
  | 'aerial_grass_rock'
  | 'white_stucco'
  | 'concrete_tile_facade'

function tex(url: string, repeat: number, srgb: boolean): THREE.Texture {
  const t = loader.load(url)
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
