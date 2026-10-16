import { Bank } from './bank'
import { PRELOAD, type Sound } from './catalog'
import { busGain, loadAudioPrefs, saveAudioPref, type AudioPrefs, type VolumeKey } from './prefs'
import { impulse } from './reverb'

export type Bus = 'music' | 'sfx' | 'ambience' | 'ui'

export interface Graph {
  ctx: AudioContext
  master: GainNode
  buses: Record<Bus, GainNode>
  /** Feeds the city echo; one-shots send part of themselves here. */
  reverb: GainNode
  /** Pause dims the world (sfx and ambience) through this. */
  world: GainNode
  /** Closes down under water. */
  lowpass: BiquadFilterNode
}

export interface PlayOptions {
  bus?: Bus
  gain?: number
  rate?: number
  delay?: number
  echo?: number
  variant?: number
}

const OPEN = 20000
const MUFFLED = 520

/**
 * The audio graph: music, sfx, ambience, and ui buses into a master. Sfx and ambience pass
 * through a shared low-pass (under water) and a pause dimmer. Built on the first click or key,
 * the earliest a browser lets a page make sound; muted while the tab is hidden.
 */
export class Mixer {
  graph: Graph | null = null
  readonly prefs: AudioPrefs = loadAudioPrefs()
  readonly bank = new Bank(() => this.graph?.ctx ?? null)
  /** Run once the graph exists (the menu theme starts here). */
  onUnlock: () => void = () => {}

  constructor() {
    for (const s of PRELOAD) this.bank.prefetch(s)
    const unlock = () => this.unlock()
    for (const type of ['pointerdown', 'keydown']) addEventListener(type, unlock, { capture: true })
    document.addEventListener('visibilitychange', () => {
      const ctx = this.graph?.ctx
      if (!ctx) return
      if (document.hidden) void ctx.suspend()
      else void ctx.resume()
    })
  }

  get ctx(): AudioContext | null {
    return this.graph?.ctx ?? null
  }

  /** Called from user gestures; safe to call again. */
  unlock(): void {
    if (this.graph) {
      if (this.graph.ctx.state === 'suspended' && !document.hidden) void this.graph.ctx.resume()
      return
    }
    try {
      this.graph = build(new AudioContext({ latencyHint: 'interactive' }))
    } catch (err) {
      console.warn('No Web Audio here; the game runs silent.', err)
      return
    }
    this.apply()
    for (const s of PRELOAD) this.bank.get(s)
    this.onUnlock()
  }

  /** Change one setting: applied at once and saved. */
  set<K extends keyof AudioPrefs>(name: K, value: AudioPrefs[K]): void {
    this.prefs[name] = value
    saveAudioPref(name, value)
    this.apply()
  }

  bus(name: Bus): AudioNode | null {
    return this.graph?.buses[name] ?? null
  }

  /**
   * A sound once, not placed in the world: menus and the player's own body and gun. A random
   * variant unless `variant` picks one. `echo` sends that much to the street reverb.
   */
  play(sound: Sound, o: PlayOptions = {}): void {
    const g = this.graph
    const variants = this.bank.get(sound)
    if (!g || !variants || g.ctx.state !== 'running') return
    const src = g.ctx.createBufferSource()
    src.buffer = variants[o.variant ?? Math.floor(Math.random() * variants.length)] ?? variants[0]
    src.playbackRate.value = o.rate ?? 1
    const gain = g.ctx.createGain()
    gain.gain.value = o.gain ?? 1
    src.connect(gain).connect(g.buses[o.bus ?? 'sfx'])
    if (o.echo) {
      const send = g.ctx.createGain()
      send.gain.value = o.echo
      gain.connect(send).connect(g.reverb)
    }
    src.start(g.ctx.currentTime + (o.delay ?? 0))
  }

  /** Muffle sfx and ambience while the camera is under water. */
  underwater(on: boolean): void {
    const g = this.graph
    if (g) g.lowpass.frequency.setTargetAtTime(on ? MUFFLED : OPEN, g.ctx.currentTime, 0.08)
  }

  /** 1 for full, less to dim the world (pause, the map). */
  dimWorld(level: number): void {
    const g = this.graph
    if (g) g.world.gain.setTargetAtTime(level, g.ctx.currentTime, 0.15)
  }

  private apply(): void {
    const g = this.graph
    if (!g) return
    const t = g.ctx.currentTime
    g.master.gain.setTargetAtTime(busGain(this.prefs, 'master'), t, 0.03)
    for (const bus of Object.keys(g.buses) as Bus[]) {
      g.buses[bus].gain.setTargetAtTime(busGain(this.prefs, bus as VolumeKey), t, 0.03)
    }
  }
}

function build(ctx: AudioContext): Graph {
  const gain = () => ctx.createGain()
  const master = gain()
  const world = gain()
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = OPEN
  const buses = { music: gain(), sfx: gain(), ambience: gain(), ui: gain() }
  buses.music.connect(master)
  buses.ui.connect(master)
  buses.sfx.connect(world)
  buses.ambience.connect(world)
  world.connect(lowpass).connect(master)
  master.connect(ctx.destination)
  const reverb = gain()
  const convolver = ctx.createConvolver()
  convolver.buffer = impulse(ctx, 1.8)
  reverb.connect(convolver).connect(buses.sfx)
  return { ctx, master, buses, reverb, world, lowpass }
}
