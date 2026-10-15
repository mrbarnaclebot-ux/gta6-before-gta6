import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FollowCamera } from './camera/follow-camera'
import { Combat } from './combat/combat'
import { newPistol } from './combat/weapon'
import type { Input } from './input/input'
import { Life } from './life/life'
import { createPhysics, FIXED_STEP } from './physics'
import { Avatar } from './player/avatar'
import { loadFigures } from './player/figure'
import { Player } from './player/player'
import { Look } from './look'
import { advance, START_HOUR } from './render/daynight'
import { loadGraphics, presetOf } from './render/graphics'
import { installHeightFog } from './render/height-fog'
import { Renderer } from './render/renderer'
import { Shadows } from './render/shadows'
import { Sky } from './render/sky'
import { exposeTestHook } from './test-hook'
import { createUi, updateHud, type Ui } from './ui/hud-sync'
import { CarModels } from './vehicle/car-model'
import { Driving } from './vehicle/driving'
import { parkCars } from './vehicle/fleet'
import { buildCity } from './world/city'
import { DETAIL_LAYER } from './world/instancing'

const MAX_FRAME = 0.1

/** ?time=21.5 starts the clock at that hour: handy for checking night by hand. */
function startHour(): number {
  const t = Number(new URLSearchParams(location.search).get('time'))
  return t >= 0 && t < 24 && location.search.includes('time=') ? t : START_HOUR
}

/** Renderer, physics, sky, city, and the loaded models. */
async function loadWorld(canvas: HTMLCanvasElement) {
  installHeightFog()
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000)
  camera.layers.enable(DETAIL_LAYER)
  const renderer = new Renderer(canvas, scene, camera)
  const sky = new Sky(scene)
  const shadows = new Shadows(scene, camera, sky.sun)
  const physics = await createPhysics()
  const gltf = new GLTFLoader()
  const load = (url: string) => gltf.loadAsync(url)
  const [figures, city] = await Promise.all([
    loadFigures(load),
    buildCity({ scene, physics }, load, sky.ambient),
    sky.load(renderer.gl),
  ])
  // Car bodies load after the first frame (see startGame); box bodies stand in till then.
  const carModels = new CarModels(scene)
  return { scene, camera, renderer, sky, shadows, physics, figures, city, carModels, load }
}

/** The player on foot, the parked cars, and who is driving what. */
function spawnPlayer(world: Awaited<ReturnType<typeof loadWorld>>) {
  const { scene, physics, figures, city } = world
  const avatar = new Avatar(figures.male)
  scene.add(avatar.root)
  const player = new Player(physics, avatar, city.spawn, city.water)
  const cars = parkCars({ scene, physics }, city, world.carModels.make)
  return { player, cars, driving: new Driving(physics, cars, player, scene) }
}

async function buildScene(canvas: HTMLCanvasElement) {
  const world = await loadWorld(canvas)
  const { scene, camera, renderer, sky, shadows, physics, figures, city, carModels } = world
  const makeCar = carModels.make
  const { player, cars, driving } = spawnPlayer(world)
  const follow = new FollowCamera(camera, physics, player.collider)
  const { layout, spawn } = city
  const people = [figures.male, figures.female]
  const life = new Life({ scene, physics, layout, people, makeCar, player, driving })
  const combat = new Combat({
    ...{ scene, physics, player, follow, layout, spawn },
    mannequin: figures.mannequin,
    cars: [...cars, ...life.traffic.cars],
    targets: life.crowd.people,
  })
  life.onRevive = () => Object.assign(combat.shooter.pistol, newPistol())
  const clock = { hours: startHour() }
  return {
    scene,
    camera,
    renderer,
    sky,
    shadows,
    physics,
    player,
    driving,
    follow,
    city,
    combat,
    life,
    clock,
    carModels,
    upgradeCars: () => carModels.upgrade(world.load),
  }
}

export type World = Awaited<ReturnType<typeof buildScene>>

const VIEW = new THREE.Vector3()

/** One frame of play: fixed 60 Hz physics with render-rate interpolation, then everything that follows it. */
function simulate(w: World, input: Input, dt: number, acc: number): number {
  for (acc += dt; acc >= FIXED_STEP; acc -= FIXED_STEP) {
    w.driving.fixedUpdate(FIXED_STEP, input, w.follow.yaw)
    w.physics.step()
  }
  const { ambient } = w.sky
  w.driving.night = ambient.night
  w.driving.update(dt, acc / FIXED_STEP)
  const car = w.driving.car
  w.follow.ignore = car?.collider ?? w.player.collider
  w.follow.update(dt, input.consumeLook(), w.driving.position, car ? chase(car) : undefined)
  const armed = w.driving.mode === 'walking' && !w.life.dead
  w.combat.update(dt, input, armed, w.renderer.gl.domElement.height)
  const { shots, lastShot } = w.combat.shooter
  w.camera.getWorldDirection(VIEW)
  w.life.update(dt, VIEW, { count: shots, ...lastShot }, ambient.night)
  w.clock.hours = advance(w.clock.hours, dt)
  w.sky.setTime(w.clock.hours)
  w.city.update(dt, w.camera)
  w.sky.setUnderwater(w.city.underwater)
  return acc
}

const FORWARD = new THREE.Vector3()
export function chase(car: { quaternion: THREE.Quaternion; speed: number }) {
  FORWARD.set(0, 0, 1).applyQuaternion(car.quaternion)
  return { heading: Math.atan2(FORWARD.x, FORWARD.z), speed: car.speed }
}

/** Long frames are clamped, not caught up. While paused the world holds still but still draws. */
function runLoop(w: World, input: Input, ui: Ui, look: Look, onFrame: (dt: number) => void) {
  let acc = 0
  let last = performance.now()
  w.renderer.gl.setAnimationLoop((now) => {
    // The first animation frame can be stamped before `last` when a long task (shader
    // compiles) delays it, so a negative step is clamped too, or the world would stall.
    const dt = Math.min(Math.max((now - last) / 1000, 0), MAX_FRAME)
    last = now
    if (input.consume('pause')) ui.pause.toggle()
    if (!ui.pause.open) acc = simulate(w, input, dt, acc)
    w.carModels.newFrame()
    look.update(dt)
    w.renderer.render(dt)
    onFrame(dt)
  })
}

export async function startGame(canvas: HTMLCanvasElement, input: Input): Promise<void> {
  const w = await buildScene(canvas)
  w.sky.setTime(w.clock.hours)
  const look = new Look(w, loadGraphics())
  const ui = createUi(w, input, look)
  let frames = 0
  runLoop(w, input, ui, look, (dt) => {
    updateHud(ui, w, dt)
    // The car bodies are the heaviest download; fetch them once the city is on screen.
    if (frames++ === 0) void w.upgradeCars()
  })
  exposeTestHook({
    ...w,
    input,
    setGraphics: ui.setGraphics,
    graphics: () => look.graphics,
    paused: () => ui.pause.open,
    extra: () => ({
      fps: Math.round(ui.hud.fps),
      frames,
      quality: presetOf(look.graphics),
      drawCalls: w.renderer.gl.info.render.calls,
      triangles: w.renderer.gl.info.render.triangles,
    }),
  })
}
