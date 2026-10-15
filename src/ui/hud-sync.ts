import { chase, type World } from '../game'
import type { Input } from '../input/input'
import { nearest } from '../life/places'
import { cooling, searchRadius, stars } from '../life/wanted'
import { MAX_BREATH, MAX_HEALTH } from '../player/swim'
import type { Look } from '../look'
import { saveGraphics, type Graphics } from '../render/graphics'
import { loadPrefs, savePref, type Prefs } from '../settings'
import { Hud } from './hud'
import { paintBase } from './map-paint'
import { Minimap } from './minimap'
import { Nav } from './nav'
import type { PauseMenu } from './pause'
import { WorldMap } from './worldmap'

// How long the red hit marker stays over the crosshair, in seconds.
const HIT_MARK = 0.18

export interface Ui {
  hud: Hud
  pause: PauseMenu
  map: Minimap
  worldMap: WorldMap
  nav: Nav
  /** Shows a help toast the first time `key` comes up. */
  tip: (key: string, message: string) => void
  /** Apply, show, and save graphics settings (also used by the test hook). */
  setGraphics: (g: Graphics) => void
}

/** Puts one display or control preference into effect. */
function applyPref(w: World, hud: Hud, name: keyof Prefs, value: Prefs[keyof Prefs]): void {
  if (name === 'sensitivity') w.follow.sensitivity = value as number
  if (name === 'invertY') w.follow.invertY = value as boolean
  if (name === 'fov') w.follow.baseFov = value as number
  if (name === 'showFps') hud.setFpsVisible(value as boolean)
  if (name === 'hudScale') document.documentElement.style.setProperty('--hud-scale', String(value))
}

/** The HUD, maps, and pause menu, with settings loaded from and saved to localStorage. */
export function createUi(w: World, input: Input, look: Look, pause: PauseMenu): Ui {
  const hud = new Hud()
  const prefs = loadPrefs()
  for (const name of Object.keys(prefs) as (keyof Prefs)[]) applyPref(w, hud, name, prefs[name])
  const setGraphics = (g: Graphics) => {
    look.apply(g)
    pause.setGraphics(g)
    saveGraphics(g)
  }
  const nav = new Nav(w.city.layout)
  const base = paintBase(w.city.layout)
  const worldMap = new WorldMap(base, w.city.layout, w.life.hospitals, nav)
  pause.playing = true
  pause.hooks = {
    onGraphics: (g) => {
      look.apply(g)
      saveGraphics(g)
    },
    onPref: (name, value) => {
      applyPref(w, hud, name, value)
      savePref(name, value)
    },
    onResume: (fromClick) => {
      input.reset()
      if (fromClick) input.lockPointer()
    },
    autoOpen: () => !worldMap.open,
  }
  const map = new Minimap(
    document.getElementById('minimap') as HTMLCanvasElement,
    base,
    w.life.hospitals,
  )
  const seen = new Set<string>()
  const tip = (key: string, message: string) => {
    if (!seen.has(key)) hud.toast(message)
    seen.add(key)
  }
  return { hud, pause, map, worldMap, nav, tip, setGraphics }
}

/** Esc and M: the pause menu and the map. Returns whether the world should hold still. */
export function menuKeys(ui: Ui, w: World, input: Input): boolean {
  const map = input.consume('map')
  if (input.consume('pause')) {
    if (ui.worldMap.open) closeMap(ui, input)
    else ui.pause.toggle()
  } else if (map && !ui.pause.open && !w.life.dead) {
    if (ui.worldMap.open) closeMap(ui, input)
    else ui.worldMap.show(mapPlayer(w))
  }
  return ui.pause.open || ui.worldMap.open
}

function closeMap(ui: Ui, input: Input): void {
  ui.worldMap.close()
  input.reset()
  // M is a user gesture, so the mouse can be captured again straight away.
  input.lockPointer()
}

function mapPlayer(w: World) {
  const car = w.driving.car
  const p = w.driving.position
  return {
    x: p.x,
    z: p.z,
    heading: car ? chase(car).heading : w.player.avatar.root.rotation.y,
    cars: w.driving.cars
      .filter((c) => c !== car)
      .map((c) => ({ x: c.position.x, z: c.position.z, heading: chase(c).heading })),
  }
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
  helpTips(ui, w)
  hud.frame()
}

/** First-time hints, top left. */
function helpTips(ui: Ui, w: World): void {
  const p = w.driving.position
  if (ui.nav.update(p)) ui.hud.toast('You have arrived.')
  const mode = w.driving.mode
  if (mode === 'driving') ui.tip('drive', 'Space is the handbrake. Press F to get out.')
  if (mode === 'swimming') ui.tip('swim', 'Ctrl or C dives. Space comes back up.')
  if (stars(w.life.wanted) > 0)
    ui.tip('wanted', 'Police are searching the red area. Get out of it to lose them.')
}

function drawMap(ui: Ui, w: World, dt: number): void {
  if (ui.worldMap.open) return ui.worldMap.draw()
  const { wanted } = w.life
  const level = stars(wanted)
  // The search area blinks while the player is outside it, like the stars.
  const blink = !cooling(wanted) || Math.floor(performance.now() / 450) % 2 === 0
  ui.map.draw(
    {
      ...mapPlayer(w),
      yaw: w.follow.yaw,
      driving: w.driving.car !== null,
      search: level ? { x: wanted.x, z: wanted.z, r: searchRadius(wanted), blink } : null,
      route: ui.nav.path,
    },
    dt,
  )
}
