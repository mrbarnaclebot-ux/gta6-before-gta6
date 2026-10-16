import * as THREE from 'three'
import { ktx2 } from '../render/ktx2'

/*
 * The owner's room pictures (seen through windows) and shop and billboard elevations, as two
 * KTX2 array textures built by scripts/compress-assets.mjs. They load after the first frame,
 * so the first visit waits for none of their 1.4 MB; until then a flat stand-in shows.
 * Shaders read them through these shared uniforms, so swapping in the real file needs no
 * recompile. Layer order is the ROOMS and SIGNS lists in compress-assets.mjs.
 */

/** A flat array texture of `layers` layers in one dim, warm color. */
function standIn(layers: number, rgb: [number, number, number]): THREE.DataArrayTexture {
  const data = new Uint8Array(4 * layers)
  for (let i = 0; i < layers; i++) data.set([...rgb, 255], i * 4)
  const t = new THREE.DataArrayTexture(data, 1, 1, layers)
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

type Slot = { value: THREE.Texture }

export const ROOMS: Slot = { value: standIn(6, [92, 84, 74]) }
export const SIGNS: Slot = { value: standIn(10, [200, 196, 188]) }

/** Fetches both arrays and swaps them in. A failed fetch keeps the stand-ins and only warns. */
export async function loadLateTextures(): Promise<void> {
  const load = async (slot: Slot, name: string) => {
    const t = await ktx2().loadAsync(`/assets/textures/${name}.ktx2`)
    t.anisotropy = 8
    slot.value.dispose()
    slot.value = t
  }
  await Promise.all([load(ROOMS, 'rooms'), load(SIGNS, 'signs')]).catch((e: unknown) =>
    console.warn('room and sign art failed', e),
  )
}
