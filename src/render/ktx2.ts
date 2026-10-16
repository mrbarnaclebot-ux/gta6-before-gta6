import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

// The Basis transcoder (copied from three/examples/jsm/libs/basis; ktx2.test.ts keeps it in step).
const TRANSCODER = '/assets/basis/'

let loader: KTX2Loader | null = null

/** One KTX2 loader for the game: it picks the GPU format (ASTC, BC7, ETC2) from the renderer. */
export function initKtx2(gl: THREE.WebGLRenderer): KTX2Loader {
  loader ??= new KTX2Loader().setTranscoderPath(TRANSCODER).detectSupport(gl)
  return loader
}

export function ktx2(): KTX2Loader {
  if (!loader) throw new Error('initKtx2(renderer) must run before KTX2 textures load')
  return loader
}

/**
 * Turns a placeholder into the loaded compressed texture in place, so materials made before
 * the file arrived keep their own wrap and repeat settings and need no recompile.
 */
export function adopt(into: THREE.Texture, from: THREE.CompressedTexture): void {
  const t = into as THREE.CompressedTexture
  t.mipmaps = from.mipmaps
  t.format = from.format
  t.type = from.type
  t.colorSpace = from.colorSpace
  t.minFilter = from.minFilter
  t.generateMipmaps = false
  t.flipY = false
  t.source = from.source
  t.needsUpdate = true
}
