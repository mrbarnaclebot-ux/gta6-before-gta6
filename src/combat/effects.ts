import * as THREE from 'three'
import { Decals } from './decals'
import { ParticlePool, type Spawn } from './particles'
import { dotTexture, flashTexture, smokeTexture } from './textures'

/** What a bullet hit decides how the impact looks. */
export type Surface = 'world' | 'metal' | 'flesh'

const FLASH_TIME = 0.05
const FLASH_LIGHT = 40
const SPARK = new THREE.Color(6, 3.4, 1.2)
const DUST = new THREE.Color(0.62, 0.58, 0.52)
const LIGHT_SMOKE = new THREE.Color(0.55, 0.55, 0.56)
const DARK_SMOKE = new THREE.Color(0.08, 0.08, 0.085)

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const v = new THREE.Vector3()

/** Muzzle flash, sparks, dust, car smoke, and bullet holes. Everything is pooled and lives in the scene from the start. */
export class Effects {
  private readonly sparks = new ParticlePool(160, dotTexture(), true)
  private readonly dust = new ParticlePool(96, smokeTexture(), false)
  private readonly smoke = new ParticlePool(160, smokeTexture(), false)
  private readonly decals = new Decals()
  // Always in the scene and dark when idle: adding a light later would recompile every shader.
  private readonly light = new THREE.PointLight(0xffb060, 0, 9, 2)
  private readonly flash: THREE.Sprite
  private flashAge = Infinity

  constructor(scene: THREE.Scene) {
    const mat = new THREE.SpriteMaterial({
      map: flashTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: new THREE.Color(5, 4, 3),
    })
    this.flash = new THREE.Sprite(mat)
    this.flash.visible = false
    scene.add(this.sparks.points, this.dust.points, this.smoke.points, this.decals.mesh)
    scene.add(this.light, this.flash)
  }

  muzzle(at: THREE.Vector3, dir: THREE.Vector3): void {
    this.flash.position.copy(at).addScaledVector(dir, 0.07)
    this.flash.scale.setScalar(rand(0.28, 0.4))
    this.flash.material.rotation = Math.random() * Math.PI * 2
    this.light.position.copy(at)
    this.flashAge = 0
    this.puff(this.dust, at, dir, 0.6, [0.06, 0.4], 0.35, LIGHT_SMOKE, 0.5)
  }

  impact(point: THREE.Vector3, normal: THREE.Vector3, surface: Surface): void {
    if (surface === 'world') this.decals.add(point, normal)
    const sparks = surface === 'flesh' ? 0 : surface === 'metal' ? 14 : 7
    for (let i = 0; i < sparks; i++) {
      v.copy(normal)
        .multiplyScalar(rand(2, 6))
        .add(randomDir(rand(1, 4)))
      this.sparks.spawn(spawn(point, v, rand(0.12, 0.35), [0.035, 0.01], 1, SPARK, -9.8, 0.5))
    }
    const puffs = surface === 'metal' ? 1 : 3
    for (let i = 0; i < puffs; i++) {
      this.puff(this.dust, point, normal, rand(0.6, 1.4), [0.1, 0.7], 0.5, DUST, rand(0.8, 1.4))
    }
  }

  /** One rising puff of car-engine smoke; `heavy` is the black smoke of a wrecked car. */
  carSmoke(at: THREE.Vector3, heavy: boolean): void {
    v.set(rand(-0.3, 0.3), rand(0.8, 1.6), rand(-0.3, 0.3))
    const size: [number, number] = heavy ? [0.6, 3.2] : [0.4, 2]
    const color = heavy ? DARK_SMOKE : LIGHT_SMOKE
    this.smoke.spawn(spawn(at, v, rand(1.8, 3), size, heavy ? 0.8 : 0.45, color, 0.6, 0.4))
  }

  update(dt: number, viewHeight: number): void {
    this.flashAge += dt
    const on = this.flashAge < FLASH_TIME
    this.flash.visible = on
    this.light.intensity = on ? FLASH_LIGHT * (1 - this.flashAge / FLASH_TIME) : 0
    for (const pool of [this.sparks, this.dust, this.smoke]) pool.update(dt, viewHeight)
  }

  private puff(
    pool: ParticlePool,
    at: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    size: [number, number],
    alpha: number,
    color: THREE.Color,
    life: number,
  ): void {
    v.copy(dir).multiplyScalar(speed).add(randomDir(0.3))
    pool.spawn(spawn(at, v, life, size, alpha, color, 0.3, 2.5))
  }
}

function randomDir(length: number): THREE.Vector3 {
  return new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(length)
}

function spawn(
  at: THREE.Vector3,
  vel: THREE.Vector3,
  life: number,
  size: [number, number],
  alpha: number,
  color: THREE.Color,
  lift: number,
  drag: number,
): Spawn {
  return { at, vel, life, size, alpha, color, lift, drag }
}
