import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { facingYaw, mapBones, type BoneMap } from './bone-map'
import { Retarget } from './retarget'

const DIR = '/assets/models/character/'
const MALE_HEIGHT = 1.78
const FEMALE_HEIGHT = 1.68
// Around the spine, this close, everything above the shoulders is head and hair.
const HEAD_RADIUS = 0.14
/** The right-hand child that holds the gun: it turns like the mannequin's DEF-handR on any rig. */
export const GUN_HAND = 'GunHand'

/** A character template: clone `root`, then play `clip(name)` (mannequin clip names) on the clone. */
export interface Figure {
  root: THREE.Object3D
  clip(name: string): THREE.AnimationClip | undefined
  /** The mannequin bone a figure bone stands in for, by name, if any. */
  role(boneName: string): string | undefined
}

/** The animated mannequin, and the generated man and woman driven by its clips. */
export interface Figures {
  mannequin: Figure
  male: Figure
  female: Figure
}

function castShadows(root: THREE.Object3D): void {
  root.traverse((o) => {
    o.castShadow = (o as THREE.Mesh).isMesh
    o.receiveShadow = (o as THREE.Mesh).isMesh
  })
}

/** Swaps the toy orange and purple for a neutral clay and graphite crash-test look. */
function mannequinFigure(gltf: GLTF): Figure {
  const root = gltf.scene
  root.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (!mat) return
    const joint = mat.name === 'M_Joints'
    mat.color.set(joint ? 0x2b2e33 : 0xd9d3c7)
    mat.roughness = joint ? 0.35 : 0.55
    mat.metalness = joint ? 0.6 : 0
  })
  castShadows(root)
  root.getObjectByName('DEF-handR')!.add(Object.assign(new THREE.Object3D(), { name: GUN_HAND }))
  const clip = (name: string) => THREE.AnimationClip.findByName(gltf.animations, name) ?? undefined
  return { root, clip, role: (n) => (n.startsWith('DEF-') ? n : undefined) }
}

/** Stands a generated character up facing +Z, `height` tall, feet at 0. */
function standUp(model: THREE.Object3D, bones: THREE.Object3D[], height: number): void {
  model.updateMatrixWorld(true)
  model.rotation.y = facingYaw(bones)
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  model.scale.multiplyScalar(height / (box.max.y - box.min.y))
  model.position.y -= box.min.y * (height / (box.max.y - box.min.y))
  model.updateMatrixWorld(true)
}

/**
 * A rig without a neck (Tripo's female) skins parts of the face to the shoulder bones,
 * which tears the face as soon as the arms move. Bind the head to the chest alone.
 */
function pinHead(mesh: THREE.SkinnedMesh, map: BoneMap): void {
  const bone = (role: string) => [...map.names].find(([, n]) => n === role)?.[0]
  if (bone('DEF-neck')) return
  const chest = bone('DEF-spine003')!
  const v = new THREE.Vector3()
  const shoulders = ['DEF-shoulderL', 'DEF-shoulderR'].map((r) => bone(r)!.getWorldPosition(v).y)
  const top = Math.max(...shoulders)
  const axis = chest.getWorldPosition(new THREE.Vector3())
  const index = mesh.geometry.attributes.skinIndex as THREE.BufferAttribute
  const weight = mesh.geometry.attributes.skinWeight as THREE.BufferAttribute
  const chestIndex = mesh.skeleton.bones.indexOf(chest as THREE.Bone)
  for (let i = 0; i < index.count; i++) {
    mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
    if (v.y < top || Math.hypot(v.x - axis.x, v.z - axis.z) > HEAD_RADIUS) continue
    index.setXYZW(i, chestIndex, 0, 0, 0)
    weight.setXYZW(i, 1, 0, 0, 0)
  }
  index.needsUpdate = weight.needsUpdate = true
}

/** A generated, auto-rigged character playing the mannequin's clips. */
function rigFigure(gltf: GLTF, height: number, mannequin: GLTF): Figure {
  const model = gltf.scene
  const root = new THREE.Group().add(model)
  let mesh: THREE.SkinnedMesh | undefined
  model.traverse(
    (o) => (mesh ??= (o as THREE.SkinnedMesh).isSkinnedMesh ? (o as THREE.SkinnedMesh) : undefined),
  )
  const bones = mesh!.skeleton.bones
  standUp(model, bones, height)
  castShadows(root)
  const map = mapBones(bones)
  pinHead(mesh!, map)
  const source = clone(mannequin.scene)
  source.updateMatrixWorld(true)
  const top = bones.find((b) => !(b.parent as THREE.Bone).isBone)!
  const retarget = new Retarget(source, mannequin.animations, top, map)
  retarget.socket('DEF-handR').name = GUN_HAND
  const roles = new Map([...map.names].map(([b, n]) => [b.name, n]))
  return { root, clip: (n) => retarget.clip(n), role: (n) => roles.get(n) }
}

/** A generated character, or `fallback` if it fails to load or is not a humanoid rig. */
async function tryRig(
  load: (url: string) => Promise<GLTF>,
  file: string,
  height: number,
  mannequin: GLTF,
  fallback: Figure,
): Promise<Figure> {
  try {
    return rigFigure(await load(DIR + file), height, mannequin)
  } catch (err) {
    console.warn(`${file} failed, using the mannequin`, err)
    return fallback
  }
}

/** The mannequin is required (it carries every clip); the generated people fall back to it. */
export async function loadFigures(load: (url: string) => Promise<GLTF>): Promise<Figures> {
  const gltf = await load(DIR + 'mannequin_ual.glb')
  const mannequin = mannequinFigure(gltf)
  const [male, female] = await Promise.all([
    tryRig(load, 'male.glb', MALE_HEIGHT, gltf, mannequin),
    tryRig(load, 'female.glb', FEMALE_HEIGHT, gltf, mannequin),
  ])
  return { mannequin, male, female: female === mannequin ? male : female }
}
