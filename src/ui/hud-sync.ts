import { chase, type World } from '../game'
import type { Input } from '../input/input'
import { nearest } from '../life/places'
import { cooling, searchRadius, stars } from '../life/wanted'
import { MAX_BREATH, MAX_HEALTH } from '../player/swim'
import {
  loadQuality,
  loadSensitivity,
  saveQuality,
  saveSensitivity,
  type Quality,
} from '../settings'
import { Hud } from './hud'
import { Minimap } from './minimap'
import { PauseMenu } from './pause'

// How long the red hit marker stays over the crosshair, in seconds.
const HIT_MARK = 0.18

export interface Ui {
  hud: Hud
  pause: PauseMenu
  map: Minimap
  quality: () => Quality
  setQuality: (q: Quality) => void
}

/** The HUD, minimap, and pause menu, with settings loaded from and saved to localStorage. */
export function createUi(w: World, input: Input): Ui {
  let quality = loadQuality()
  const setQuality = (q: Quality) => {
    quality = q
    w.renderer.setQuality(q)
    w.sky.setQuality(q)
    pause.setQuality(q)
    saveQuality(q)
  }
  w.follow.sensitivity = loadSensitivity()
  const pause = new PauseMenu({
    quality,
    sensitivity: w.follow.sensitivity,
    onQuality: () => setQuality(quality === 'high' ? 'low' : 'high'),
    onSensitivity: (v) => {
      w.follow.sensitivity = v
      saveSensitivity(v)
    },
    onResume: (fromClick) => {
      input.reset()
      if (fromClick) input.lockPointer()
    },
  })
  setQuality(quality)
  const map = new Minimap(
    document.getElementById('minimap') as HTMLCanvasElement,
    w.city.layout,
    w.life.hospitals,
  )
  return { hud: new Hud(), pause, map, quality: () => quality, setQuality }
}

export function updateHud(ui: Ui, w: World, dt: number): void {
  const { hud } = ui
  const { vitals } = w.player
  hud.setVitals(vitals.health / MAX_HEALTH, vitals.breath / MAX_BREATH)
  hud.setUnderwater(w.city.underwater)
  const car = w.driving.car
  const warning = car?.stalled ? 'Engine flooded' : car?.dead ? 'Engine destroyed' : null
  hud.setSpeed(car ? Math.abs(car.speed) * 3.6 : null, warning)
  const { pistol, raised, sinceHit } = w.combat.shooter
  const onFoot = w.driving.mode === 'walking' && !w.life.dead
  hud.setWeapon(
    onFoot
      ? {
          mag: pistol.mag,
          reserve: pistol.reserve,
          reloading: pistol.reloading > 0,
          raised,
          hit: sinceHit < HIT_MARK,
        }
      : null,
  )
  hud.setPrompt(w.driving.nearest() && !w.life.dead ? 'Get in' : null)
  const { wanted } = w.life
  hud.setWanted(stars(wanted), cooling(wanted))
  const p = w.driving.position
  hud.setDeath(w.life.dead ? nearest(w.life.hospitals, p.x, p.z).name : null)
  drawMap(ui, w, dt)
  hud.frame()
}

function drawMap(ui: Ui, w: World, dt: number): void {
  const car = w.driving.car
  const { wanted } = w.life
  const p = w.driving.position
  const level = stars(wanted)
  // The search area blinks while the player is outside it, like the stars.
  const blink = !cooling(wanted) || Math.floor(performance.now() / 450) % 2 === 0
  ui.map.draw(
    {
      x: p.x,
      z: p.z,
      yaw: w.follow.yaw,
      heading: car ? chase(car).heading : w.player.avatar.root.rotation.y,
      driving: car !== null,
      search: level ? { x: wanted.x, z: wanted.z, r: searchRadius(wanted), blink } : null,
    },
    dt,
  )
}
