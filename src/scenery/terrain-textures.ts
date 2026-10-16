import * as THREE from 'three'
import { ktx2 } from '../render/ktx2'

// Layers in shader order: grass, dirt, rock, sand (the Poly Haven sets listed in compress-assets.mjs).

type ArrayTexture = THREE.CompressedArrayTexture

function setUp(t: ArrayTexture): ArrayTexture {
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

/**
 * The four ground layers as two KTX2 texture arrays (scripts/compress-assets.mjs), so the splat
 * shader needs two samplers instead of twelve: color with roughness in alpha, and OpenGL normals.
 */
export async function terrainTextures(): Promise<{ albedo: ArrayTexture; normal: ArrayTexture }> {
  const load = (name: string) =>
    ktx2().loadAsync(`/assets/textures/terrain_${name}.ktx2`) as Promise<ArrayTexture>
  const [albedo, normal] = await Promise.all([load('albedo'), load('normal')])
  return { albedo: setUp(albedo), normal: setUp(normal) }
}
