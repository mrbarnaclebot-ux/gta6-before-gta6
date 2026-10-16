import * as THREE from 'three'
import type { World } from '../game'
import type { Input } from '../input/input'
import type { Vehicle } from '../vehicle/vehicle'
import type { Sound } from './catalog'
import { boatMix, engineMix, IDLE_RPM, impact, rpmFor } from './engine'
import { Loop } from './loop'
import type { Mixer } from './mixer'

const LAYERS: Sound[] = ['engine-idle', 'engine-2k', 'engine-4k', 'engine-5k']
// The horn file's steady middle (its sustain runs about 0.01 to 0.20 s), looped while H is held.
const HORN_LOOP = [0.05, 0.17]
const ENGINE_LEVEL = 0.5

type Body = { linvel(): { x: number; y: number; z: number } }
const RIGHT = new THREE.Vector3()

/** The vehicle the player drives: engine, skid, horn, crashes, doors, and the outboard and wake. */
export class VehicleAudio {
  private readonly layers: Loop[]
  private readonly skid: Loop
  private readonly motor: Loop
  private readonly wake: Loop
  private rpm = IDLE_RPM
  private car: Vehicle | null = null
  private readonly vel = new THREE.Vector3()
  private readonly prevVel = new THREE.Vector3()
  private fresh = true
  private crashCool = 0
  private horn: AudioBufferSourceNode | null = null
  /** Seconds since a carjacking pulled a door open; the hop in then only shuts it. */
  sinceJack = Infinity
  /** The pause menu is open: H does not honk. */
  paused = false

  constructor(
    private readonly mixer: Mixer,
    private readonly w: World,
    private readonly input: Input,
  ) {
    this.layers = LAYERS.map((s) => new Loop(mixer, s, 'sfx'))
    this.skid = new Loop(mixer, 'skid', 'sfx')
    this.motor = new Loop(mixer, 'outboard', 'sfx')
    this.wake = new Loop(mixer, 'wake', 'sfx')
  }

  update(dt: number): void {
    const car = this.w.driving.car
    if (car !== this.car) this.swap(this.car, car)
    this.car = car
    this.sinceJack += dt
    this.crashCool -= dt
    const held = this.input.held
    const throttle = Number(held.has('forward')) - Number(held.has('back'))
    const running = car && !car.dead
    this.engine(dt, car?.kind === 'car' && running ? car : null, throttle)
    const boat = car?.kind === 'boat' && running ? boatMix(car.speed, throttle) : null
    this.motor.set(boat ? boat.motor * 0.55 : 0, boat?.rate ?? 1, dt, 0.15)
    this.wake.set(car?.kind === 'boat' ? boatMix(car.speed, 0).wake * 0.5 : 0, 1, dt, 0.3)
    this.slide(dt, car?.kind === 'car' ? car : null, held.has('jump'))
    this.honk(car?.kind === 'car' && !car.dead && held.has('horn') && !this.paused)
  }

  private swap(from: Vehicle | null, to: Vehicle | null): void {
    this.fresh = true
    const door = (from ?? to)?.kind === 'car'
    if (to && door) {
      if (this.sinceJack > 3) this.mixer.play('door-open', { gain: 0.7 })
      this.mixer.play('door-close', { gain: 0.8, delay: 0.55 })
    } else if (from && door) {
      this.mixer.play('door-open', { gain: 0.7 })
      this.mixer.play('door-close', { gain: 0.8, delay: 0.6 })
    } else if (to || from) {
      // Stepping onto or off a deck.
      this.mixer.play('land', { gain: 0.35, rate: 0.9 })
    }
    if (!to) this.honk(false)
  }

  private engine(dt: number, car: Vehicle | null, throttle: number): void {
    const target = car ? rpmFor(car.speed, throttle) : IDLE_RPM
    const rise = target > this.rpm ? 7 : 3
    this.rpm += (target - this.rpm) * (1 - Math.exp(-rise * dt))
    const mix = engineMix(this.rpm, Math.abs(throttle))
    this.layers.forEach((l, i) =>
      l.set(car ? mix.gains[i] * ENGINE_LEVEL : 0, mix.rates[i], dt, 0.05),
    )
  }

  /** Tyre squeal from sideways slip or the handbrake; a crash from a sudden change of velocity. */
  private slide(dt: number, car: Vehicle | null, handbrake: boolean): void {
    const body = (car as { body?: Body } | null)?.body
    if (!car || !body) return this.skid.set(0, 1, dt)
    const lv = body.linvel()
    this.vel.set(lv.x, lv.y, lv.z)
    RIGHT.set(1, 0, 0).applyQuaternion(car.quaternion)
    const sideways = Math.abs(this.vel.dot(RIGHT))
    let slip = Math.min(1, Math.max(0, (sideways - 2.2) / 5))
    if (handbrake && Math.abs(car.speed) > 4)
      slip = Math.max(slip, Math.min(1, Math.abs(car.speed) / 14))
    this.skid.set(slip * 0.6, 0.92 + 0.16 * slip, dt, 0.06)
    // Horizontal only: dropping off a curb or a ramp changes the vertical speed, not a crash.
    const jolt = Math.hypot(this.vel.x - this.prevVel.x, this.vel.z - this.prevVel.z)
    const hit = this.fresh ? 0 : impact(jolt, dt)
    this.prevVel.copy(this.vel)
    this.fresh = false
    if (hit > 0 && this.crashCool <= 0) {
      this.crashCool = 0.35
      this.mixer.play('crash', { gain: 0.35 + 0.65 * hit, rate: 0.95 + Math.random() * 0.1 })
    }
  }

  /** H: the horn's steady part loops while held, and rings out on release. */
  private honk(on: boolean): void {
    const g = this.mixer.graph
    if (!on || !g) {
      if (this.horn) this.horn.loop = false
      this.horn = null
      return
    }
    if (this.horn) return
    const buffer = this.mixer.bank.get('horn')?.[0]
    if (!buffer) return
    const src = g.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    ;[src.loopStart, src.loopEnd] = HORN_LOOP
    const gain = g.ctx.createGain()
    gain.gain.value = 0.55
    src.connect(gain).connect(g.buses.sfx)
    src.start()
    this.horn = src
  }
}
