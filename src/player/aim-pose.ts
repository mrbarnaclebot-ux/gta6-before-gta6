import * as THREE from 'three'

// Spine, arms, neck, and head: the bones the pistol pose owns while the legs keep walking.
// GLTFLoader strips dots from node names, so DEF-spine.001 arrives as DEF-spine001.
const UPPER = /^DEF-(spine00[123]|neck|head|shoulder|upper_arm|forearm|hand|f_|thumb)/
// Measured arm elevation of the Pistol_Aim_Up and Pistol_Aim_Down clips, in radians.
const UP_ANGLE = 1.2
const DOWN_ANGLE = 1.38
const BLEND_RATE = 14
const RELOAD_FADE = 0.15

const q = new THREE.Quaternion()
const tilt = new THREE.Quaternion()
const ref = new THREE.Quaternion()

/** Reads one clip's bone rotations at any time, without an AnimationMixer. */
class Sampler {
  readonly duration: number
  private readonly tracks: (THREE.Interpolant | null)[]

  constructor(clips: THREE.AnimationClip[], name: string, bones: THREE.Object3D[]) {
    const clip = THREE.AnimationClip.findByName(clips, name)!
    this.duration = clip.duration
    this.tracks = bones.map((b) => {
      const track = clip.tracks.find((t) => t.name === `${b.name}.quaternion`)
      if (!track) return null
      return new THREE.QuaternionLinearInterpolant(
        track.times,
        track.values,
        4,
        new Float32Array(4),
      )
    })
  }

  /** Bone `i`'s rotation at time `t` into `out`; false if this clip does not move that bone. */
  at(i: number, t: number, out: THREE.Quaternion): boolean {
    const track = this.tracks[i]
    if (!track) return false
    out.fromArray(track.evaluate(t) as unknown as number[])
    return true
  }
}

/**
 * Pistol upper-body layer, applied after the locomotion mixer so the legs keep walking.
 * It samples the clips directly: a second AnimationMixer only writes a bone when its
 * own output changes, so a static aim pose would lose to the walk cycle every frame.
 */
export class AimPose {
  private readonly bones: THREE.Object3D[] = []
  private readonly level: Sampler
  private readonly up: Sampler
  private readonly down: Sampler
  private readonly shoot: Sampler
  private readonly reloading: Sampler
  private blend = 0
  private shootT = -1
  private reloadT = -1

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    root.traverse((o) => {
      if (UPPER.test(o.name)) this.bones.push(o)
    })
    const sampler = (name: string) => new Sampler(clips, name, this.bones)
    this.level = sampler('Pistol_Aim_Neutral')
    this.up = sampler('Pistol_Aim_Up')
    this.down = sampler('Pistol_Aim_Down')
    this.shoot = sampler('Pistol_Shoot')
    this.reloading = sampler('Pistol_Reload')
  }

  /** The gun is (nearly) all the way up. */
  get raised(): boolean {
    return this.blend > 0.8
  }

  fire(): void {
    this.shootT = 0
  }

  reload(): void {
    this.reloadT = 0
  }

  /** Call after the locomotion mixer. `on` raises the gun; `elevation` is the aim angle above the horizon. */
  apply(dt: number, on: boolean, elevation: number): void {
    this.shootT = advance(this.shootT, dt, this.shoot.duration)
    this.reloadT = advance(this.reloadT, dt, this.reloading.duration)
    const busy = this.reloadT >= 0
    this.blend += (Number(on || busy) - this.blend) * Math.min(1, dt * BLEND_RATE)
    if (this.blend < 0.01) return
    const t = THREE.MathUtils.clamp(elevation / (elevation > 0 ? UP_ANGLE : DOWN_ANGLE), -1, 1)
    const r = busy ? fade(this.reloadT, this.reloading.duration) : 0
    this.bones.forEach((bone, i) => {
      if (!this.level.at(i, 0, q)) return
      if ((t > 0 ? this.up : this.down).at(i, 0, tilt)) q.slerp(tilt, Math.abs(t))
      if (r > 0 && this.reloading.at(i, this.reloadT, tilt)) q.slerp(tilt, r)
      // Recoil as a delta from the shoot clip's first frame, so it kicks at any aim pitch.
      if (this.shootT >= 0 && this.shoot.at(i, 0, ref) && this.shoot.at(i, this.shootT, tilt)) {
        q.multiply(ref.invert().multiply(tilt))
      }
      bone.quaternion.slerp(q, this.blend)
    })
  }
}

/** Step a one-shot clip's clock; -1 means not playing. */
function advance(t: number, dt: number, duration: number): number {
  if (t < 0) return t
  return t + dt > duration ? -1 : t + dt
}

/** Ease a one-shot clip in and out over RELOAD_FADE at each end. */
function fade(t: number, duration: number): number {
  return Math.min(1, t / RELOAD_FADE, (duration - t) / RELOAD_FADE)
}
