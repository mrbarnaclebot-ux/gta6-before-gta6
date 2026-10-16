import * as THREE from 'three'
import type { Sound } from './catalog'
import type { Mixer } from './mixer'

const VOICES = 10

/**
 * Sound in the world: three's AudioListener rides the camera and PositionalAudio voices
 * pan and fade by distance. The listener feeds the sfx bus, so volume, the pause dimmer, and
 * the underwater filter apply. One-shots share a small pool; the oldest voice is reused.
 */
export class Space {
  readonly listener: THREE.AudioListener
  private readonly pool: THREE.PositionalAudio[] = []
  private next = 0

  constructor(
    private readonly mixer: Mixer,
    camera: THREE.Camera,
    private readonly scene: THREE.Scene,
  ) {
    THREE.AudioContext.setContext(mixer.ctx!)
    this.listener = new THREE.AudioListener()
    this.listener.gain.disconnect()
    this.listener.gain.connect(mixer.bus('sfx')!)
    camera.add(this.listener)
    for (let i = 0; i < VOICES; i++) this.pool.push(this.voice())
  }

  /** A positional voice in the scene, for callers that keep their own (engines, the siren). */
  voice(ref = 4): THREE.PositionalAudio {
    const v = new THREE.PositionalAudio(this.listener)
    v.setRefDistance(ref)
    v.setRolloffFactor(1.2)
    // Equal-power panning is far cheaper than HRTF and plenty for cars and voices.
    v.panner.panningModel = 'equalpower'
    this.scene.add(v)
    return v
  }

  /** One sound at a world point. `ref`: meters at which it plays at full volume. */
  play(sound: Sound, at: THREE.Vector3, o: { gain?: number; rate?: number; ref?: number } = {}) {
    const variants = this.mixer.bank.get(sound)
    if (!variants || this.mixer.ctx?.state !== 'running') return
    const v = this.free()
    if (v.isPlaying) v.stop()
    v.setBuffer(variants[Math.floor(Math.random() * variants.length)])
    v.setRefDistance(o.ref ?? 4)
    v.setPlaybackRate(o.rate ?? 1)
    v.gain.gain.value = o.gain ?? 1
    place(v, at)
    v.play()
  }

  private free(): THREE.PositionalAudio {
    const idle = this.pool.find((v) => !v.isPlaying)
    if (idle) return idle
    this.next = (this.next + 1) % this.pool.length
    return this.pool[this.next]
  }
}

/** Moves a voice and snaps its panner there, so a reused voice does not sweep across the stereo field. */
export function place(v: THREE.PositionalAudio, at: THREE.Vector3): void {
  v.position.copy(at)
  v.updateMatrixWorld()
  const t = v.context.currentTime
  const p = v.panner
  for (const [param, value] of [
    [p.positionX, at.x],
    [p.positionY, at.y],
    [p.positionZ, at.z],
  ] as const) {
    param.cancelScheduledValues(t)
    param.setValueAtTime(value, t)
  }
}
