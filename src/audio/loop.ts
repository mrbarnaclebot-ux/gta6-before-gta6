import { LOOP_PAD, type Sound } from './catalog'
import type { Bus, Mixer } from './mixer'

/** Loops sounding right now, for the test hook. */
export const sounding = new Set<Sound>()

/**
 * A looping sound with a volume and a pitch that glide toward their targets: engines, the
 * skid, ambience. It loads when first asked to be heard, and stops (and, with `unload`, frees
 * its buffer) after a while at zero.
 */
export class Loop {
  private src: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private silent = 0

  constructor(
    private readonly mixer: Mixer,
    readonly sound: Sound,
    private readonly bus: Bus,
    private readonly o: { unload?: boolean; idleStop?: number } = {},
  ) {}

  get playing(): boolean {
    return this.src !== null
  }

  /** Call every frame. `glide` is the time constant in seconds. */
  set(volume: number, rate: number, dt: number, glide = 0.08): void {
    const g = this.mixer.graph
    if (!g) return
    this.silent = volume > 0.001 ? 0 : this.silent + dt
    if (this.silent > (this.o.idleStop ?? 3)) return this.stop()
    if (!this.src && volume > 0.001) this.start()
    if (!this.src || !this.gain) return
    const t = g.ctx.currentTime
    this.gain.gain.setTargetAtTime(volume, t, glide)
    this.src.playbackRate.setTargetAtTime(rate, t, glide)
  }

  private start(): void {
    const g = this.mixer.graph!
    const buffer = this.mixer.bank.get(this.sound)?.[0]
    if (!buffer) return
    const src = g.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.loopStart = LOOP_PAD
    src.loopEnd = buffer.duration - LOOP_PAD
    this.gain = g.ctx.createGain()
    this.gain.gain.value = 0
    src.connect(this.gain).connect(g.buses[this.bus])
    // A random start, so two cars (or two visits) never sound in lockstep.
    src.start(0, LOOP_PAD + Math.random() * (src.loopEnd - LOOP_PAD))
    this.src = src
    sounding.add(this.sound)
  }

  stop(): void {
    if (this.o.unload) this.mixer.bank.unload(this.sound)
    if (!this.src) return
    this.src.stop()
    this.src.disconnect()
    this.gain?.disconnect()
    this.src = null
    this.gain = null
    sounding.delete(this.sound)
  }
}
