import type * as THREE from 'three'
import { doppler } from './engine'
import type { Mixer } from './mixer'
import { place, type Space } from './space'
import { LOOP_PAD } from './catalog'

// A real cruiser switches patterns; so does this one, every few seconds.
const PATTERNS = [
  { hz: 0.23, cents: 650 }, // wail: a slow rise and fall
  { hz: 3.3, cents: 480 }, // yelp: the fast US warble
]
const SWITCH = 6.5
const LEVEL = 0.9

/**
 * The police siren: a held siren tone whose pitch a slow or fast triangle LFO sweeps into a
 * wail or a yelp, placed on the nearest cruiser with a doppler shift as it passes.
 */
export class Siren {
  private readonly voice: THREE.PositionalAudio
  private lfo: OscillatorNode | null = null
  private depth: GainNode | null = null
  private clock = 0
  private lastDist = -1
  private lastAt: THREE.Vector3 | null = null

  constructor(
    private readonly mixer: Mixer,
    space: Space,
  ) {
    this.voice = space.voice(14)
    this.voice.setLoop(true)
  }

  /** Each frame: `at` the cruiser to sound from, or null for silence. */
  update(dt: number, at: THREE.Vector3 | null, listener: THREE.Vector3): void {
    const v = this.voice
    // A different cruiser (or none): no closing speed from the old one's distance.
    if (at !== this.lastAt) this.lastDist = -1
    this.lastAt = at
    if (!at) {
      if (v.isPlaying) v.gain.gain.setTargetAtTime(0, v.context.currentTime, 0.4)
      if (v.isPlaying && v.gain.gain.value < 0.01) v.stop()
      return
    }
    if (!v.isPlaying && !this.start(at)) return
    v.position.copy(at)
    const d = at.distanceTo(listener)
    const closing = this.lastDist < 0 || dt <= 0 ? 0 : (this.lastDist - d) / dt
    this.lastDist = d
    v.setPlaybackRate(0.92 * doppler(closing))
    v.gain.gain.setTargetAtTime(LEVEL, v.context.currentTime, 0.3)
    this.clock += dt
    const p = PATTERNS[Math.floor(this.clock / SWITCH) % PATTERNS.length]
    const t = v.context.currentTime
    this.lfo!.frequency.setTargetAtTime(p.hz, t, 0.15)
    this.depth!.gain.setTargetAtTime(p.cents, t, 0.15)
  }

  private start(at: THREE.Vector3): boolean {
    const buffer = this.mixer.bank.get('siren')?.[0]
    const ctx = this.mixer.ctx
    if (!buffer || !ctx) return false
    const v = this.voice
    v.setBuffer(buffer)
    v.loopStart = LOOP_PAD
    v.loopEnd = buffer.duration - LOOP_PAD
    v.offset = LOOP_PAD
    v.gain.gain.value = 0
    place(v, at)
    v.play()
    if (!this.lfo) {
      this.lfo = ctx.createOscillator()
      this.lfo.type = 'triangle'
      this.depth = ctx.createGain()
      this.lfo.connect(this.depth)
      this.lfo.start()
    }
    // play() makes a new buffer source each time; sweep its pitch in cents.
    this.depth!.disconnect()
    this.depth!.connect((v.source as AudioBufferSourceNode).detune)
    return true
  }
}
