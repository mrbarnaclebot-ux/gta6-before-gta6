import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FollowCamera } from './camera/follow-camera'
import type { Input } from './input/input'
import { createPhysics, FIXED_STEP } from './physics'
import { Avatar } from './player/avatar'
import { Player } from './player/player'
import { Renderer } from './render/renderer'
import { Sky } from './render/sky'
import { loadQuality, saveQuality, type Quality } from './settings'
import { exposeTestHook } from './test-hook'
import { Hud } from './ui/hud'
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
  const [avatar, city] = await Promise.all([
    Avatar.load(load),
    buildCity({ scene, physics }, load, sky.sunDir),
    sky.load(),
  ])
  scene.add(avatar.root)
  const player = new Player(physics, avatar, city.spawn)
  const follow = new FollowCamera(camera, physics, player.collider)
  return { scene, camera, renderer, sky, physics, player, follow, city }
}

type World = Awaited<ReturnType<typeof buildScene>>

/** Fixed 60 Hz physics with render-rate interpolation; long frames are clamped, not caught up. */
function runLoop(w: World, input: Input, onFrame: () => void): void {
  let acc = 0
  let last = performance.now()
  w.renderer.gl.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, MAX_FRAME)
    last = now
    acc += dt
    while (acc >= FIXED_STEP) {
      w.player.fixedUpdate(FIXED_STEP, input, w.follow.yaw)
      w.physics.step()
      acc -= FIXED_STEP
    }
    w.player.update(dt, acc / FIXED_STEP)
    w.follow.update(dt, input.consumeLook(), w.player.position)
    w.sky.follow(w.player.position)
    w.city.update(dt)
    w.renderer.render(dt)
    onFrame()
  })
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
    hud.frame()
    frames++
  })
  exposeTestHook({
    player: w.player,
    follow: w.follow,
    input,
    setQuality,
    landmarks: w.city.landmarks,
    extra: () => ({
      fps: Math.round(hud.fps),
      frames,
      quality,
      drawCalls: w.renderer.gl.info.render.calls,
      triangles: w.renderer.gl.info.render.triangles,
    }),
  })
}
