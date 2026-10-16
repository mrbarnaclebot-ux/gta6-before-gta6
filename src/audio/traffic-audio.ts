import type * as THREE from 'three'
import type { World } from '../game'
import { stars } from '../life/wanted'
import type { TrafficCar } from '../life/traffic-car'
import { LOOP_PAD } from './catalog'
import { trafficRate } from './engine'
import type { Mixer } from './mixer'
import { Siren } from './siren'
import { place, type Space } from './space'

/** Engines heard at once: the nearest few cars only. */
const ENGINES = 3
const ENGINE_RANGE = 45
const SIREN_RANGE = 220
const PICK_EVERY = 0.3

interface EngineVoice {
  audio: THREE.PositionalAudio
  car: TrafficCar | null
}

/** Other people's cars: engines of the nearest few, the siren on the closest cruiser, and wrecks blowing up. */
export class TrafficAudio {
  private readonly engines: EngineVoice[] = []
  private readonly siren: Siren
  private pickIn = 0
  private readonly hp = new WeakMap<object, number>()

  constructor(
    private readonly mixer: Mixer,
    private readonly space: Space,
    private readonly w: World,
  ) {
    for (let i = 0; i < ENGINES; i++) {
      const audio = space.voice(5)
      audio.setLoop(true)
      this.engines.push({ audio, car: null })
    }
    this.siren = new Siren(mixer, space)
  }

  update(dt: number): void {
    const here = this.w.camera.position
    const cars = this.w.life.traffic.cars.filter((c) => c.visual.root.visible && !c.dead)
    if ((this.pickIn -= dt) <= 0) {
      this.pickIn = PICK_EVERY
      this.pick(cars, here)
    }
    for (const e of this.engines) this.drive(e)
    const wanted = stars(this.w.life.wanted) > 0
    this.siren.update(
      dt,
      wanted ? (nearest(cars, here, SIREN_RANGE, true)?.position ?? null) : null,
      here,
    )
    this.wrecks()
  }

  /** Hands the engine voices to the nearest cars, keeping a voice on a car that stays near. */
  private pick(cars: TrafficCar[], here: THREE.Vector3): void {
    const near = cars
      .map((c) => ({ c, d: c.position.distanceTo(here) }))
      .filter((x) => x.d < ENGINE_RANGE)
      .sort((a, b) => a.d - b.d)
      .slice(0, ENGINES)
      .map((x) => x.c)
    for (const e of this.engines) if (e.car && !near.includes(e.car)) e.car = null
    for (const car of near) {
      if (this.engines.some((e) => e.car === car)) continue
      const free = this.engines.find((e) => !e.car)
      if (free) this.assign(free, car)
    }
  }

  private assign(e: EngineVoice, car: TrafficCar): void {
    const buffer = this.mixer.bank.get('engine-2k')?.[0]
    if (!buffer) return
    e.car = car
    const a = e.audio
    if (a.isPlaying) a.stop()
    a.setBuffer(buffer)
    a.loopStart = LOOP_PAD
    a.loopEnd = buffer.duration - LOOP_PAD
    a.offset = LOOP_PAD + Math.random() * (buffer.duration - 3 * LOOP_PAD)
    a.gain.gain.value = 0
    place(a, car.position)
    a.play()
  }

  private drive(e: EngineVoice): void {
    const a = e.audio
    if (!a.isPlaying) return
    const t = a.context.currentTime
    if (!e.car) {
      a.gain.gain.setTargetAtTime(0, t, 0.25)
      if (a.gain.gain.value < 0.01) a.stop()
      return
    }
    a.position.copy(e.car.position)
    a.setPlaybackRate(trafficRate(e.car.speed))
    a.gain.gain.setTargetAtTime(0.35, t, 0.3)
  }

  /** A car whose health just hit zero goes up in a boom. */
  private wrecks(): void {
    const all = [...this.w.driving.cars, ...this.w.life.traffic.cars]
    for (const c of all) {
      const before = this.hp.get(c) ?? c.health.hp
      if (before > 0 && c.health.hp <= 0) {
        this.space.play('explode', c.position, {
          gain: 1,
          ref: 14,
          rate: 0.9 + Math.random() * 0.15,
        })
      }
      this.hp.set(c, c.health.hp)
    }
  }
}

function nearest(cars: TrafficCar[], at: THREE.Vector3, range: number, police: boolean) {
  let best: TrafficCar | null = null
  let bestD = range
  for (const c of cars) {
    if (police && !c.visual.police) continue
    const d = c.position.distanceTo(at)
    if (d < bestD) [best, bestD] = [c, d]
  }
  return best
}
