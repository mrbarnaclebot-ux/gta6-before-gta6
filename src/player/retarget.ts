import * as THREE from 'three'
import type { BoneMap } from './bone-map'

const FPS = 30
// Bones that branch off a limb: never the direction a bone points in.
const BRANCH = /shoulder|thumb|thigh/

const q = new THREE.Quaternion()
const v = new THREE.Vector3()
const s = new THREE.Vector3()

const worldPos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())
const worldRot = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion())

/** Every bone under `top`, parents before children. */
function bonesUnder(top: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  top.traverse((o) => {
    if ((o as THREE.Bone).isBone) out.push(o)
  })
  return out
}

/**
 * Plays the mannequin's clips on another humanoid rig. Each mapped bone takes the
 * mannequin bone's world rotation, offset so both rest poses line up: the offset turns
 * the rig's bone to point where the mannequin's does at rest (A-pose arms to T-pose)
 * and then carries over each frame's change from rest. Clips are baked on first use.
 */
export class Retarget {
  private readonly order: THREE.Object3D[]
  private readonly parent: number[]
  private readonly from: (THREE.Object3D | null)[]
  /** Per bone: source rest^-1 * alignment * rig rest, so rig world = source world * offset. */
  private readonly offset: THREE.Quaternion[] = []
  private readonly base: THREE.Quaternion
  private readonly world: THREE.Quaternion[]
  private readonly hips: THREE.Object3D
  private readonly hipsRest: THREE.Vector3
  private readonly moverRest: THREE.Vector3
  private readonly moverParent: THREE.Matrix4
  private readonly ratio: number
  private readonly aligned: THREE.Quaternion[] = []
  private readonly rest = new Map<THREE.Object3D, [THREE.Vector3, THREE.Quaternion]>()
  private readonly cache = new Map<string, THREE.AnimationClip | undefined>()

  /** Both skeletons at rest, facing +Z, world matrices current. */
  constructor(
    private readonly source: THREE.Object3D,
    private readonly clips: THREE.AnimationClip[],
    top: THREE.Object3D,
    private readonly map: BoneMap,
  ) {
    const named = (n: string) => source.getObjectByName(n)!
    this.order = bonesUnder(top)
    this.parent = this.order.map((b) => this.order.indexOf(b.parent!))
    this.from = this.order.map((b) => (map.names.has(b) ? named(map.names.get(b)!) : null))
    this.base = worldRot(top.parent!)
    this.world = this.order.map(() => new THREE.Quaternion())
    source.traverse((o) => this.rest.set(o, [o.position.clone(), o.quaternion.clone()]))
    this.order.forEach((b, i) => this.offset.push(this.restOffset(b, i)))
    this.hips = named('DEF-hips')
    this.hipsRest = worldPos(this.hips)
    this.moverRest = worldPos(map.mover)
    this.moverParent = map.mover.parent!.matrixWorld.clone().invert()
    const thigh = [...map.names].find(([, n]) => n === 'DEF-thighL')![0]
    this.ratio = worldPos(thigh).y / worldPos(named('DEF-thighL')).y
  }

  /** Rotation that turns the rig bone to point along the mannequin bone; a parent's if it has no aim. */
  private alignment(bone: THREE.Object3D, i: number): THREE.Quaternion {
    const names = this.map.names
    const kids = bone.children.filter((k) => names.has(k) && !BRANCH.test(names.get(k)!))
    const aim = kids.find((k) => names.get(k)!.includes('f_middle')) ?? kids[0]
    if (!aim) return this.parent[i] >= 0 ? this.aligned[this.parent[i]] : new THREE.Quaternion()
    const from = worldPos(aim).sub(worldPos(bone)).normalize()
    const src = this.source.getObjectByName(names.get(aim)!)!
    const to = worldPos(src).sub(worldPos(this.from[i]!)).normalize()
    return new THREE.Quaternion().setFromUnitVectors(from, to)
  }

  private restOffset(bone: THREE.Object3D, i: number): THREE.Quaternion {
    if (!this.from[i]) {
      this.aligned.push(this.parent[i] >= 0 ? this.aligned[this.parent[i]] : new THREE.Quaternion())
      return new THREE.Quaternion()
    }
    const align = this.alignment(bone, i)
    this.aligned.push(align)
    return worldRot(this.from[i]!).invert().multiply(align).multiply(worldRot(bone))
  }

  /** A child of `bone` whose world rotation matches the mannequin bone it stands for, at any pose. */
  socket(sourceName: string): THREE.Object3D {
    const i = this.from.findIndex((b) => b?.name === sourceName)
    const socket = new THREE.Object3D()
    socket.quaternion.copy(this.offset[i]).invert()
    this.order[i].add(socket)
    return socket
  }

  clip(name: string): THREE.AnimationClip | undefined {
    if (!this.cache.has(name)) this.cache.set(name, this.bake(name))
    return this.cache.get(name)
  }

  private bake(name: string): THREE.AnimationClip | undefined {
    const src = THREE.AnimationClip.findByName(this.clips, name)
    if (!src) return undefined
    const frames = Math.max(2, Math.round(src.duration * FPS) + 1)
    const times = new Float32Array(frames)
    const rots = this.order.map(() => new Float32Array(frames * 4))
    const moves = new Float32Array(frames * 3)
    const mixer = new THREE.AnimationMixer(this.source)
    const action = mixer.clipAction(src).setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
    for (let f = 0; f < frames; f++) {
      times[f] = (f / (frames - 1)) * src.duration
      mixer.setTime(times[f])
      this.source.updateMatrixWorld(true)
      this.frame(f, rots, moves)
    }
    mixer.stopAllAction()
    mixer.uncacheRoot(this.source)
    this.rest.forEach(([p, r], o) => (o.position.copy(p), o.quaternion.copy(r)))
    const tracks: THREE.KeyframeTrack[] = this.order.flatMap((b, i) =>
      this.from[i]
        ? [new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, rots[i])]
        : [],
    )
    tracks.push(new THREE.VectorKeyframeTrack(`${this.map.mover.name}.position`, times, moves))
    return new THREE.AnimationClip(name, src.duration, tracks)
  }

  /** One sampled frame: every mapped bone's local rotation, and the mover's position. */
  private frame(f: number, rots: Float32Array[], moves: Float32Array): void {
    this.order.forEach((bone, i) => {
      const parent = this.parent[i] >= 0 ? this.world[this.parent[i]] : this.base
      const src = this.from[i]
      if (!src) return void this.world[i].multiplyQuaternions(parent, bone.quaternion)
      src.matrixWorld.decompose(v, q, s)
      this.world[i].multiplyQuaternions(q, this.offset[i])
      q.copy(parent)
        .invert()
        .multiply(this.world[i])
        .toArray(rots[i], f * 4)
    })
    this.hips.matrixWorld.decompose(v, q, s)
    v.sub(this.hipsRest).multiplyScalar(this.ratio).add(this.moverRest)
    v.applyMatrix4(this.moverParent).toArray(moves, f * 3)
  }
}
