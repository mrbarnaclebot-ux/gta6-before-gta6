import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { expect, test, vi } from 'vitest'
import { facingYaw, mapBones } from './bone-map'

/** Loads a character's skeleton in Node (textures fail to decode here, which is fine), facing +Z. */
async function bonesOf(file: string): Promise<Map<string, string>> {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('self', globalThis)
  const buf = readFileSync(`public/assets/models/character/${file}`)
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const gltf = await new GLTFLoader().parseAsync(data, '')
  const bones: THREE.Object3D[] = []
  gltf.scene.traverse((o) => (o as THREE.Bone).isBone && bones.push(o))
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.rotation.y = facingYaw(bones)
  gltf.scene.updateMatrixWorld(true)
  const { names, mover } = mapBones(bones)
  const out = new Map([...names].map(([b, n]) => [b.name, n]))
  out.set('mover', mover.name)
  return out
}

// Spot checks from the AssetHub hand-made bone tables: the left/right names are misleading on purpose.
test('maps the generated man by shape', async () => {
  const m = await bonesOf('male.glb')
  expect(m.get('tripoSpine_0')).toBe('DEF-hips')
  expect(m.get('tripo0_Right_Limb_1')).toBe('DEF-spine003')
  expect(m.get('tripoHead_1')).toBe('DEF-head')
  expect(m.get('tripo0_Right_Limb_5')).toBe('DEF-handL')
  expect(m.get('bone_28')).toBe('DEF-handR')
  expect(m.get('bone_13')).toBe('DEF-f_index01L')
  expect(m.get('bone_42')).toBe('DEF-f_pinky02R')
  expect(m.get('tripo1_Left_Limb_0')).toBe('DEF-thighL')
  expect(m.get('tripo0_Left_Limb_3')).toBe('DEF-toeR')
  expect(m.get('mover')).toBe('tripoRoot')
})

test('maps the generated woman, who has no neck', async () => {
  const f = await bonesOf('female.glb')
  expect(f.get('tripo0_Right_Limb_0')).toBe('DEF-hips')
  expect(f.get('tripo0_Right_Limb_2')).toBe('DEF-spine003')
  expect(f.get('tripoHead_0')).toBe('DEF-shoulderR')
  expect(f.get('bone_7')).toBe('DEF-handR')
  expect(f.get('bone_17')).toBe('DEF-f_ring01R')
  expect(f.get('bone_14')).toBe('DEF-f_pinky01R')
  expect(f.get('bone_20')).toBe('DEF-thumb01R')
  expect(f.get('tripo0_Right_Limb_7')).toBe('DEF-f_middle01L')
  expect(f.get('tripo1_Left_Limb_0')).toBe('DEF-thighR')
  expect([...f.values()]).not.toContain('DEF-neck')
})

test('maps the mannequin onto itself', async () => {
  const m = await bonesOf('mannequin_ual.glb')
  for (const [bone, role] of m) if (bone !== 'mover') expect(role).toBe(bone)
  expect(m.get('mover')).toBe('DEF-hips')
})
