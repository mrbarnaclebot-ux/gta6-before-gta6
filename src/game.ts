import * as THREE from 'three'
import type { BootAudio } from './audio/boot'
import { gameSound } from './audio/game-audio'
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
import { presetOf } from './render/graphics'
import { installHeightFog } from './render/height-fog'
import { Renderer } from './render/renderer'
import { Shadows } from './render/shadows'
import { Sky } from './render/sky'
import { exposeTestHook } from './test-hook'
import { createUi, menuKeys, updateHud, type Ui } from './ui/hud-sync'
import type { Loading } from './ui/loading'
import type { PauseMenu } from './ui/pause'
import { buildHarbor } from './boat/harbor'
import type { Boat } from './boat/boat'
import { CarModels } from './vehicle/car-model'
import { Driving } from './vehicle/driving'
import { parkCars } from './vehicle/fleet'
import { underwaterLightAll } from './sea/caustics'
import { buildCity } from './world/city'
import { DETAIL_LAYER } from './world/instancing'
import { StaticColliders } from './world/static-colliders'
import { modelLoader } from './world/load-model'
import { initKtx2 } from './render/ktx2'

const MAX_FRAME = 0.1

/** ?time=21.5 starts the clock at that hour: handy for checking night by hand. */
function startHour(): number {
  const t = Number(new URLSearchParams(location.search).get('time'))
  return t >= 0 && t < 24 && location.search.includes('time=') ? t : START_HOUR
}

/** Renderer, physics, sky, city, and the loaded models. */
async function loadWorld(canvas: HTMLCanvasElement, loading: Loading) {
  installHeightFog()
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000)
  camera.layers.enable(DETAIL_LAYER)
  const renderer = new Renderer(canvas, scene, camera)
  const sky = new Sky(scene)
  const shadows = new Shadows(scene, camera, sky.sun)
  const physics = await createPhysics()
  const colliders = new StaticColliders(physics)
  loading.finish('physics')
  // Every loader here uses three's default manager, so it sees each glb, hdr, and texture.
  const files = THREE.DefaultLoadingManager
  files.onProgress = (_url, loaded, total) => loading.files(loaded, total)
  initKtx2(renderer.gl)
  const load = modelLoader()
  const [figures, city] = await Promise.all([
    loadFigures(load),
    buildCity({ scene, physics, colliders }, load, sky.ambient, renderer.gl),
    sky.load(renderer.gl),
  ])
  files.onProgress = () => {}
  loading.finish('files')
  // Car bodies load after the first frame (see startGame); box bodies stand in till then.
  const carModels = new CarModels(scene)
  return {
    scene,
    camera,
    renderer,
    sky,
    shadows,
    physics,
    colliders,
    figures,
    city,
    carModels,
    load,
  }
}

/** The player on foot, the parked cars, the boats, and who is driving what. */
function spawnPlayer(world: Awaited<ReturnType<typeof loadWorld>>) {
  const { scene, physics, colliders, figures, city } = world
  const ctx = { scene, physics, colliders }
  const avatar = new Avatar(figures.male)
  underwaterLightAll(avatar.root)
  scene.add(avatar.root)
  const player = new Player(physics, avatar, city.spawn, city.water)
  const harbor = buildHarbor(ctx, city.layout, city.water)
  const cars = [...parkCars(ctx, city, world.carModels.make), ...harbor.boats]
  return { player, cars, harbor, driving: new Driving(physics, cars, player, scene, city.water) }
}

async function buildScene(canvas: HTMLCanvasElement, loading: Loading) {
  const world = await loadWorld(canvas, loading)
  const { scene, camera, renderer, sky, shadows, physics, colliders, figures, city, carModels } =
    world
  const makeCar = carModels.make
  const { player, cars, harbor, driving } = spawnPlayer(world)
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
  life.carjack.onSteal = (gone, fresh) => combat.swap(gone, fresh)
  const clock = { hours: startHour() }
  return {
    scene,
    camera,
    renderer,
    sky,
    shadows,
    physics,
    colliders,
    player,
    driving,
    follow,
    city,
    combat,
    life,
    clock,
    carModels,
    harbor,
    upgradeCars: () => Promise.all([carModels.upgrade(world.load), harbor.upgrade(world.load)]),
  }
}

export type World = Awaited<ReturnType<typeof buildScene>>

const VIEW = new THREE.Vector3()

/** One frame of play: fixed 60 Hz physics with render-rate interpolation, then everything that follows it. */
function simulate(w: World, input: Input, dt: number, acc: number): number {
  // Before the step: after a teleport the colliders around the new spot exist already.
  w.colliders.update([w.driving.position, w.camera.position])
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
  const boat = car?.kind === 'boat' ? (car as Boat) : null
  w.harbor.wake.update(dt, boat, w.sky.ambient, w.renderer.gl.domElement.height)
  w.harbor.setNight(ambient.night)
  const armed = w.driving.mode === 'walking' && !w.life.dead
  w.combat.update(dt, input, armed, w.renderer.gl.domElement.height)
  const { shots, lastShot } = w.combat.shooter
  w.camera.getWorldDirection(VIEW)
  w.life.update(dt, VIEW, { count: shots, ...lastShot }, ambient.night)
  w.clock.hours = advance(w.clock.hours, dt)
  w.sky.setTime(w.clock.hours)
  const swimmer = w.driving.mode === 'swimming' ? w.driving.position : null
  w.city.update(dt, w.camera, swimmer)
  w.sky.setUnderwater(w.city.underwater, w.city.underwaterDepth)
  return acc
}

const FORWARD = new THREE.Vector3()
export function chase(car: { quaternion: THREE.Quaternion; speed: number; kind?: string }) {
  FORWARD.set(0, 0, 1).applyQuaternion(car.quaternion)
  return { heading: Math.atan2(FORWARD.x, FORWARD.z), speed: car.speed, boat: car.kind === 'boat' }
}

/** Main-thread time spent on frames so far (simulate, draw submission, HUD), for the perf probe. */
const CPU_WORK = { ms: 0, frames: 0 }

/** Long frames are clamped, not caught up. While paused the world holds still but still draws. */
function runLoop(w: World, input: Input, ui: Ui, look: Look, onFrame: (dt: number) => void) {
  let acc = 0
  const work = CPU_WORK
  let last = performance.now()
  w.renderer.gl.setAnimationLoop((now) => {
    // The first animation frame can be stamped before `last` when a long task (shader
    // compiles) delays it, so a negative step is clamped too, or the world would stall.
    const dt = Math.min(Math.max((now - last) / 1000, 0), MAX_FRAME)
    last = now
    const t0 = performance.now()
    if (!menuKeys(ui, w, input)) acc = simulate(w, input, dt, acc)
    w.carModels.newFrame()
    look.update(dt)
    w.renderer.render(dt)
    onFrame(dt)
    work.ms += performance.now() - t0
    work.frames++
  })
}

/** What the title screen hands over: its settings menu, the loading screen, and the mixer. */
export interface Boot {
  pause: PauseMenu
  loading: Loading
  audio: BootAudio
}

export async function startGame(
  canvas: HTMLCanvasElement,
  input: Input,
  boot: Boot,
): Promise<void> {
  const { loading } = boot
  const w = await buildScene(canvas, loading)
  w.sky.setTime(w.clock.hours)
  const look = new Look(w, boot.pause.graphics)
  const ui = createUi(w, input, look, boot.pause)
  loading.finish('world')
  const sound = gameSound(boot.audio, w, input, ui)
  // Every material in the scene, hidden levels of detail too, compiles behind the loading
  // screen (in parallel where the browser can), not mid-drive when it first comes into view.
  await w.renderer.gl.compileAsync(w.scene, w.camera)
  let frames = 0
  let carsIn = false
  runLoop(w, input, ui, look, (dt) => {
    updateHud(ui, w, dt)
    sound.update(dt)
    if (frames++ > 0) return
    // The first frame (and its shader compiles) is drawn: lift the loading screen.
    loading.ready()
    boot.audio.enterGame()
    ui.tip('map', 'Press M for the map. Click on it to set a waypoint.')
    ui.tip('car', 'Walk up to a parked car and press F to get in.')
    // The car bodies are the heaviest download; fetch them once the city is on screen.
    void w.upgradeCars().then(() => (carsIn = true))
  })
  exposeTestHook({
    ...w,
    dock: w.harbor.dock,
    input,
    setGraphics: ui.setGraphics,
    graphics: () => look.graphics,
    paused: () => ui.pause.open,
    ui,
    audio: sound.state,
    extra: () => ({
      fps: Math.round(ui.hud.fps),
      frames,
      quality: presetOf(look.graphics),
      drawCalls: w.renderer.gl.info.render.calls,
      triangles: w.renderer.gl.info.render.triangles,
      geometries: w.renderer.gl.info.memory.geometries,
      textures: w.renderer.gl.info.memory.textures,
      cpu: { ...CPU_WORK },
      ...w.colliders.stats,
      /** Everything around the player is in: car bodies fetched, collider tiles built. */
      streamed: carsIn && !w.colliders.busy,
    }),
  })
}
