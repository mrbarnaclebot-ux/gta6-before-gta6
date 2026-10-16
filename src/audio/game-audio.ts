import type { World } from '../game'
import type { Input } from '../input/input'
import { stars } from '../life/wanted'
import type { Ui } from '../ui/hud-sync'
import { Ambience } from './ambience'
import type { BootAudio } from './boot'
import { CHASE_THEME, SOUNDS, type Sound } from './catalog'
import { CombatAudio } from './combat-audio'
import type { Mixer } from './mixer'
import { sounding } from './loop'
import { PlayerAudio } from './player-audio'
import { RadioPlayer } from './radio-player'
import { Space } from './space'
import { Stream } from './stream'
import { TrafficAudio } from './traffic-audio'
import { VehicleAudio } from './vehicle-audio'

/** How long the wasted sting holds the music down, in seconds. */
const WASTED_DUCK = 4.5
const CHASE_LEVEL = 0.7
// Loops wait until something needs them; these one-shots are tiny, so they load after Play.
const LOOPS = /^(amb-|engine-)|^(outboard|wake|swim|siren|skid)$/

/** Everything heard in play, fed from the game state every frame. */
export class GameAudio {
  private readonly space: Space
  private readonly parts: { update(dt: number): void }[]
  private readonly vehicle: VehicleAudio
  private readonly ambience: Ambience
  private readonly radio: RadioPlayer
  private readonly chase: Stream
  private readonly was = {
    stars: 0,
    dead: false,
    map: false,
    pause: false,
    target: null as object | null,
    jack: null as string | null,
  }
  private duckFor = 0
  private chaseLevel = -1

  constructor(
    private readonly mixer: Mixer,
    private readonly w: World,
    private readonly input: Input,
    private readonly ui: Ui,
  ) {
    this.space = new Space(mixer, w.camera, w.scene)
    this.vehicle = new VehicleAudio(mixer, w, input)
    this.ambience = new Ambience(mixer, w, w.harbor.dock)
    const combat = new CombatAudio(mixer, this.space, w)
    const traffic = new TrafficAudio(mixer, this.space, w)
    this.parts = [new PlayerAudio(mixer, w), this.vehicle, combat, traffic, this.ambience]
    this.radio = new RadioPlayer(mixer)
    this.chase = new Stream(mixer)
    this.chase.load(CHASE_THEME.file, true)
    for (const s of Object.keys(SOUNDS) as Sound[]) if (!LOOPS.test(s)) mixer.bank.get(s)
    this.watchToasts()
  }

  update(dt: number): void {
    const { pause, worldMap } = this.ui
    this.mixer.underwater(this.w.city.underwater)
    this.mixer.dimWorld(pause.open || worldMap.open ? 0.3 : 1)
    this.vehicle.paused = pause.open
    // Q and E pressed in the menu are dropped, not kept for when it closes.
    if (pause.open) {
      this.input.consume('radioNext')
      this.input.consume('radioPrev')
    }
    for (const part of this.parts) part.update(dt)
    this.cues()
    this.duckFor = Math.max(0, this.duckFor - dt)
    const duck = this.duckFor > 0 ? 0.15 : 1
    this.radio.update(this.w.driving.car !== null && !this.w.life.dead, this.input, duck)
    this.music(duck)
  }

  /** Stings and clicks for what just changed: stars, wasted, the map, a waypoint, a carjacking. */
  private cues(): void {
    const { life, driving } = this.w
    const ui = (s: Sound, variant?: number) => this.mixer.play(s, { bus: 'ui', variant })
    const level = stars(life.wanted)
    if (level > this.was.stars) ui('ui-wanted')
    if (life.dead && !this.was.dead) {
      ui('ui-wasted')
      this.duckFor = WASTED_DUCK
    }
    if (this.ui.worldMap.open !== this.was.map) ui('ui-map', this.ui.worldMap.open ? 0 : 1)
    if (this.ui.pause.open && !this.was.pause) ui('ui-select')
    const target = this.ui.nav.target
    if (target && target !== this.was.target) ui('ui-ping')
    const jack = life.carjack.phase
    if (jack === 'pull' && this.was.jack !== 'pull') {
      this.mixer.play('yank', { gain: 0.8 })
      this.mixer.play('grunt', { gain: 0.7, delay: 0.45 })
      this.vehicle.sinceJack = 0
    }
    if (driving.nearest())
      this.warm(['engine-idle', 'engine-2k', 'engine-4k', 'engine-5k', 'outboard', 'wake'])
    Object.assign(this.was, {
      stars: level,
      dead: life.dead,
      map: this.ui.worldMap.open,
      pause: this.ui.pause.open,
      target,
      jack,
    })
  }

  /** Chase music from two stars, unless the radio is on; faded down under the wasted sting. */
  private music(duck: number): void {
    const level = stars(this.w.life.wanted) >= 2 && !this.radio.playing ? CHASE_LEVEL * duck : 0
    if (level === this.chaseLevel) return
    this.chase.fadeTo(level, level > this.chaseLevel ? 2.5 : 5)
    this.chaseLevel = level
  }

  private warm(sounds: Sound[]): void {
    for (const s of sounds) this.mixer.bank.get(s)
  }

  /** A soft chime for each new notification toast. */
  private watchToasts(): void {
    const box = document.getElementById('toasts')
    if (!box) return
    let at = 0
    new MutationObserver((changes) => {
      if (!changes.some((c) => c.addedNodes.length) || performance.now() - at < 800) return
      at = performance.now()
      this.mixer.play('ui-chime', { bus: 'ui', gain: 0.45 })
    }).observe(box, { childList: true })
  }

  /** For the test hook. */
  state() {
    return {
      station: this.radio.state.station,
      radio: this.radio.playing,
      chase: this.chaseLevel > 0,
      loops: [...sounding].sort(),
      beds: this.ambience.weights ? { ...this.ambience.weights } : null,
    }
  }
}

/** Builds the game's audio once the mixer exists (it needs a click first), then feeds it. */
export function gameSound(boot: BootAudio, w: World, input: Input, ui: Ui) {
  let audio: GameAudio | null = null
  const { mixer } = boot
  return {
    update(dt: number): void {
      if (!audio && mixer.graph) audio = new GameAudio(mixer, w, input, ui)
      audio?.update(dt)
    },
    state: () => ({
      context: mixer.ctx?.state ?? 'none',
      prefs: { ...mixer.prefs },
      ...audio?.state(),
    }),
  }
}
