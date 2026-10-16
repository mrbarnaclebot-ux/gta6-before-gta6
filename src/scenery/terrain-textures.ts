import * as THREE from 'three'

/** Ground layers in shader order: grass, dirt, rock, sand. Poly Haven sets, see CREDITS.md. */
export const LAYERS = ['rocky_terrain_02', 'forest_ground_04', 'aerial_rocks_02', 'coast_sand_01']
const SIZE = 1024

const loader = new THREE.ImageLoader()
const load = (url: string) => loader.loadAsync(url)

function pixels(img: HTMLImageElement): Uint8ClampedArray {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, SIZE, SIZE)
  return g.getImageData(0, 0, SIZE, SIZE).data
}

function array(data: Uint8Array, srgb: boolean): THREE.DataArrayTexture {
  const t = new THREE.DataArrayTexture(data, SIZE, SIZE, LAYERS.length)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

/**
 * The four ground layers as two texture arrays, so the splat shader needs two samplers
 * instead of twelve: color with roughness in alpha, and OpenGL normals.
 */
export async function terrainTextures(): Promise<{
  albedo: THREE.DataArrayTexture
  normal: THREE.DataArrayTexture
}> {
  const layer = SIZE * SIZE * 4
  const albedo = new Uint8Array(layer * LAYERS.length)
  const normal = new Uint8Array(layer * LAYERS.length)
  await Promise.all(
    LAYERS.map(async (name, i) => {
      const base = `/assets/textures/${name}/`
      const [diff, rough, nor] = await Promise.all(
        ['diff', 'rough', 'nor_gl'].map((m) => load(`${base}${m}.jpg`)),
      )
      const d = pixels(diff)
      const r = pixels(rough)
      for (let p = 0; p < SIZE * SIZE; p++) d[p * 4 + 3] = r[p * 4]
      albedo.set(d, layer * i)
      normal.set(pixels(nor), layer * i)
    }),
  )
  return { albedo: array(albedo, true), normal: array(normal, false) }
}
