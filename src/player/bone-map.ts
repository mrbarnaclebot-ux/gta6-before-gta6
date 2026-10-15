import * as THREE from 'three'

/*
 * Finds the humanoid bones of an auto-rigged character by shape, not by name:
 * generated rigs name bones arbitrarily (Tripo's "Right_Limb" is the left arm).
 * The rig must stand facing +Z with its left on +X, like the mannequin.
 * Names on the right are the mannequin's, as GLTFLoader spells them (dots dropped).
 */

export interface BoneMap {
  /** Rig bone -> mannequin bone name. */
  names: Map<THREE.Object3D, string>
  /** The bone that carries the hips' travel: the lowest common parent of spine and legs. */
  mover: THREE.Object3D
}

const FINGERS = ['f_index', 'f_middle', 'f_ring', 'f_pinky'] as const

const pos = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3())
const boneKids = (b: THREE.Object3D) => b.children.filter((c) => (c as THREE.Bone).isBone)
const side = (b: THREE.Object3D) => (pos(b).x > 0 ? 'L' : 'R')

/** The parent `n` levels up. */
function up(b: THREE.Object3D, n: number): THREE.Object3D {
  for (let i = 0; i < n; i++) b = b.parent!
  return b
}

/** A bone and its first-child descendants, `n` long. */
function chain(b: THREE.Object3D, n: number): THREE.Object3D[] {
  const out = [b]
  while (out.length < n && boneKids(out[out.length - 1]).length) {
    out.push(boneKids(out[out.length - 1])[0])
  }
  return out
}

/** The two lowest leaf bones on opposite sides: the toes. */
export function toes(bones: THREE.Object3D[]): THREE.Object3D[] {
  const leaves = bones.filter((b) => !boneKids(b).length).sort((a, b) => pos(a).y - pos(b).y)
  const first = leaves[0]
  const other = leaves.find((b) => Math.sign(pos(b).x) !== Math.sign(pos(first).x))
  return other ? [first, other] : [first]
}

/** Yaw that turns a rig so its toes point along +Z, in quarter turns. */
export function facingYaw(bones: THREE.Object3D[]): number {
  const dir = new THREE.Vector3()
  for (const toe of toes(bones)) dir.add(pos(toe).sub(pos(toe.parent!)))
  const quarter = Math.PI / 2
  return -Math.round(Math.atan2(dir.x, dir.z) / quarter) * quarter
}

/** Thumb is the finger root nearest the wrist; the rest run index to pinky front to back. */
function mapHand(hand: THREE.Object3D, s: string, names: Map<THREE.Object3D, string>) {
  const wrist = pos(hand)
  const roots = boneKids(hand).sort((a, b) => pos(a).distanceTo(wrist) - pos(b).distanceTo(wrist))
  const thumb = roots.shift()!
  const ordered = roots.sort((a, b) => pos(b).z - pos(a).z)
  const named: [THREE.Object3D, string][] = [
    [thumb, 'thumb'],
    ...ordered.map((r, i) => [r, FINGERS[i]] as [THREE.Object3D, string]),
  ]
  for (const [root, finger] of named) {
    chain(root, 3).forEach((b, i) => names.set(b, `DEF-${finger}0${i + 1}${s}`))
  }
}

/** Spine bones from the hips up to the chest; the hips are the first bone above the legs' parent. */
function mapSpine(
  chest: THREE.Object3D,
  thigh: THREE.Object3D,
  names: Map<THREE.Object3D, string>,
) {
  const legParents = new Set<THREE.Object3D>()
  for (let b: THREE.Object3D | null = thigh.parent; b; b = b.parent) legParents.add(b)
  const spine = [chest]
  let b = chest.parent!
  for (; !legParents.has(b); b = b.parent!) spine.unshift(b)
  // Rigify-style rigs hang the legs off the hips; Tripo hangs them off the root.
  if ((b.parent as THREE.Bone | null)?.isBone) spine.unshift(b)
  const middle = ['DEF-spine001', 'DEF-spine002']
  spine.forEach((bone, i) => {
    const last = i === spine.length - 1
    names.set(
      bone,
      i === 0 ? 'DEF-hips' : last ? 'DEF-spine003' : (middle[i - 1] ?? 'DEF-spine002'),
    )
  })
  return b
}

/** Maps a rig's bones (world matrices up to date) onto the mannequin's. */
export function mapBones(bones: THREE.Object3D[]): BoneMap {
  const names = new Map<THREE.Object3D, string>()
  const feet = toes(bones)
  for (const toe of feet) {
    const s = side(toe)
    ;['toe', 'foot', 'shin', 'thigh'].forEach((role, i) => names.set(up(toe, i), `DEF-${role}${s}`))
  }
  const hands = bones.filter((b) => boneKids(b).length >= 4)
  let chest: THREE.Object3D | null = null
  for (const hand of hands) {
    const s = side(hand)
    mapHand(hand, s, names)
    ;['hand', 'forearm', 'upper_arm', 'shoulder'].forEach((role, i) =>
      names.set(up(hand, i), `DEF-${role}${s}`),
    )
    chest = up(hand, 4)
  }
  if (!chest || feet.length < 2 || hands.length !== 2) throw new Error('Not a humanoid rig')
  const mover = mapSpine(chest, up(feet[0], 3), names)
  const neck = boneKids(chest).find((b) => !names.has(b))
  if (neck) chain(neck, 2).forEach((b, i) => names.set(b, i ? 'DEF-head' : 'DEF-neck'))
  return { names, mover }
}
