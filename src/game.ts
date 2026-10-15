import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FollowCamera } from './camera/follow-camera'
import { Combat } from './combat/combat'
import type { Input } from './input/input'
import { createPhysics, FIXED_STEP } from './physics'
import { Avatar } from './player/avatar'
import { Player } from './player/player'
import { MAX_BREATH, MAX_HEALTH } from './player/swim'
import { Renderer } from './render/renderer'
import { Sky } from './render/sky'
import { loadQuality, saveQuality, type Quality } from './settings'
import { exposeTestHook } from './test-hook'
import { Hud } from './ui/hud'
import type { Car } from './vehicle/car'
import { loadCarModel } from './vehicle/car-model'
import { Driving } from './vehicle/driving'
import { parkCars } from './vehicle/fleet'
import { buildCity } from './world/city'
import { DETAIL_LAYER } from './world/instancing'

const MAX_FRAME = 0.1

async function buildScene(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000)
  camera.layers.enable(DETAIL_LAYER)
  const renderer = new Renderer(canvas, scene, camera)
  const sky = new Sky(scene)
  const physics = await createPhysics()
  const gltf = new GLTFLoader()
  const load = (url: string) => gltf.loadAsync(url)
  const [avatar, city, makeCar] = await Promise.all([
    Avatar.load(load),
    buildCity({ scene, physics }, load, sky.sunDir),
    loadCarModel(load),
    sky.load(),
  ])
  scene.add(avatar.root)
  const player = new Player(physics, avatar, city.spawn, city.water)
  const cars = parkCars({ scene, physics }, city, makeCar)
  const driving = new Driving(physics, cars, player, scene)
  const follow = new FollowCamera(camera, physics, player.collider)
  const { layout, spawn } = city
  const combat = new Combat({ scene, physics, player, follow, cars, layout, spawn })
  return { scene, camera, renderer, sky, physics, player, driving, follow, city, combat }
}

type World = Awaited<ReturnType<typeof buildScene>>

const FORWARD = new THREE.Vector3()
function chaseOf(car: Car) {
  FORWARD.set(0, 0, 1).applyQuaternion(car.quaternion)
  return { heading: Math.atan2(FORWARD.x, FORWARD.z), speed: car.speed }
}

/** Fixed 60 Hz physics with render-rate interpolation; long frames are clamped, not caught up. */
function runLoop(w: World, input: Input, onFrame: () => void): void {
  let acc = 0
  let last = performance.now()
  w.renderer.gl.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, MAX_FRAME)
    last = now
    acc += dt
    while (acc >= FIXED_STEP) {
      w.driving.fixedUpdate(FIXED_STEP, input, w.follow.yaw)
      w.physics.step()
      acc -= FIXED_STEP
    }
    w.driving.update(dt, acc / FIXED_STEP)
    const car = w.driving.car
    w.follow.ignore = car?.collider ?? w.player.collider
    w.follow.update(dt, input.consumeLook(), w.driving.position, car ? chaseOf(car) : undefined)
    w.combat.update(dt, input, w.driving.mode === 'walking', w.renderer.gl.domElement.height)
    w.sky.follow(w.driving.position)
    w.city.update(dt, w.camera)
    w.sky.setUnderwater(w.city.underwater)
    w.renderer.render(dt)
    onFrame()
  })
}

// How long the red hit marker stays over the crosshair, in seconds.
const HIT_MARK = 0.18

function updateHud(hud: Hud, w: World): void {
  const { vitals } = w.player
  hud.setVitals(vitals.health / MAX_HEALTH, vitals.breath / MAX_BREATH)
  hud.setUnderwater(w.city.underwater)
  const car = w.driving.car
  const warning = car?.stalled ? 'Engine flooded' : car?.dead ? 'Engine destroyed' : null
  hud.setSpeed(car ? Math.abs(car.speed) * 3.6 : null, warning)
  const { pistol, raised, sinceHit } = w.combat.shooter
  const weapon = {
    mag: pistol.mag,
    reserve: pistol.reserve,
    reloading: pistol.reloading > 0,
    raised,
    hit: sinceHit < HIT_MARK,
  }
  hud.setWeapon(w.driving.mode === 'walking' ? weapon : null)
  hud.setPrompt(w.driving.nearest() ? 'Get in' : null)
  hud.frame()
}

export async function startGame(canvas: HTMLCanvasElement, input: Input): Promise<void> {
  const w = await buildScene(canvas)
  let quality = loadQuality()
  let frames = 0
  const setQuality = (q: Quality) => {
    quality = q
    w.renderer.setQuality(q)
    w.sky.setQuality(q)
    hud.setQuality(q)
    saveQuality(q)
  }
  const hud = new Hud(quality, () => setQuality(quality === 'high' ? 'low' : 'high'))
  setQuality(quality)
  runLoop(w, input, () => {
    updateHud(hud, w)
    frames++
  })
  exposeTestHook({
    player: w.player,
    driving: w.driving,
    follow: w.follow,
    city: w.city,
    combat: w.combat,
    input,
    setQuality,
    extra: () => ({
      fps: Math.round(hud.fps),
      frames,
      quality,
      drawCalls: w.renderer.gl.info.render.calls,
      triangles: w.renderer.gl.info.render.triangles,
    }),
  })
}
