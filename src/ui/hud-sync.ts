import { chase, type World } from '../game'
import type { Device, Input } from '../input/input'
import { TouchControls } from '../input/touch'
import { PROMPT_KEY, TIPS } from './controls-text'
import { nearest } from '../life/places'
import { cooling, searchRadius, stars } from '../life/wanted'
import { MAX_BREATH, MAX_HEALTH } from '../player/swim'
import type { Look } from '../look'
import { saveGraphics, type Graphics } from '../render/graphics'
import { loadPrefs, savePref, type Prefs } from '../settings'
import { roadGraph } from '../land/road-graph'
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
  touch: TouchControls
  /** The device whose labels the prompts use. */
  device: () => Device
  /** Shows a help toast, worded for the device in hand, the first time `key` comes up. */
  tip: (key: keyof typeof TIPS) => void
  /** Apply, show, and save graphics settings (also used by the test hook). */
  setGraphics: (g: Graphics) => void
  /** The mouse lost pointer lock and needs a click to take it back. */
  needsRelock: () => boolean
}

/** Puts one display or control preference into effect. */
function applyPref(w: World, hud: Hud, name: keyof Prefs, value: Prefs[keyof Prefs]): void {
  if (name === 'sensitivity') w.follow.sensitivity = value as number
  if (name === 'invertY') w.follow.invertY = value as boolean
  if (name === 'fov') w.follow.baseFov = value as number
  if (name === 'showFps') hud.setFpsVisible(value as boolean)
  if (name === 'hudScale') document.documentElement.style.setProperty('--hud-scale', String(value))
}

/** The title screen's settings menu becomes the in-game pause menu. */
function takeOverPause(
  pause: PauseMenu,
  o: { w: World; hud: Hud; input: Input; look: Look; worldMap: WorldMap },
): void {
  pause.playing = true
  // The tab last picked on the title screen (often Controls) should not stick into the game.
  pause.selectTab('graphics')
  pause.hooks = {
    // The mixer outlives the title screen, so its hook carries over unchanged.
    onAudio: pause.hooks.onAudio,
    onGraphics: (g) => {
      o.look.apply(g)
      saveGraphics(g)
    },
    onPref: (name, value) => {
      applyPref(o.w, o.hud, name, value)
      savePref(name, value)
    },
    onResume: (fromClick) => {
      o.input.reset()
      if (fromClick) o.input.lockPointer()
    },
    autoOpen: () => !o.worldMap.open,
  }
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
  const nav = new Nav(roadGraph(w.city.layout, w.city.layout.paths))
  const base = paintBase(w.city.layout)
  const worldMap = new WorldMap(base, w.city.layout, w.life.hospitals, nav)
  takeOverPause(pause, { w, hud, input, look, worldMap })
  const map = new Minimap(
    document.getElementById('minimap') as HTMLCanvasElement,
    base,
    w.life.hospitals,
  )
  const seen = new Set<string>()
  const tip = (key: keyof typeof TIPS) => {
    if (!seen.has(key)) hud.toast(TIPS[key][input.device])
    seen.add(key)
  }
  const needsRelock = () => input.needsRelock
  const touch = new TouchControls(input)
  const device = () => input.device
  const ui = { hud, pause, map, worldMap, nav, touch, device, tip, setGraphics, needsRelock }
  document.getElementById('worldmap-close')!.addEventListener('click', () => closeMap(ui, input))
  pauseInPortrait(pause)
  return ui
}

/** Turning a phone upright mid-game hides the view behind the rotate notice, so pause. */
function pauseInPortrait(pause: PauseMenu): void {
  const q =
    typeof matchMedia === 'function'
      ? matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 700px)')
      : null
  q?.addEventListener?.('change', (e) => {
    if (e.matches && !pause.open) pause.show()
  })
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
  hud.setSpeed(car ? Math.abs(car.speed) : null, warning, car?.kind === 'boat' ? 'kn' : 'km/h')
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
  const action = prompt(w)
  hud.setPrompt(action, PROMPT_KEY[ui.device()])
  const menus = ui.pause.open || ui.worldMap.open || w.life.dead
  ui.touch.update(!menus, w.driving.mode, action)
  hud.setLookHint(ui.needsRelock() && !ui.pause.open && !ui.worldMap.open)
  const { wanted } = w.life
  hud.setWanted(stars(wanted), cooling(wanted))
  const p = w.driving.position
  hud.setDeath(w.life.dead ? nearest(w.life.hospitals, p.x, p.z).name : null)
  drawMap(ui, w, dt)
  helpTips(ui, w)
  hud.frame()
}

/** What F does here: get into something of one's own, or take a car from its driver. */
function prompt(w: World): string | null {
  if (w.life.dead) return null
  const near = w.driving.nearest()
  if (near) return near.kind === 'boat' ? 'Board' : 'Get in'
  return w.life.carjack.target() ? 'Take car' : null
}

/** First-time hints, top left. */
function helpTips(ui: Ui, w: World): void {
  const p = w.driving.position
  if (ui.nav.update(p)) ui.hud.toast('You have arrived.')
  const mode = w.driving.mode
  const boat = w.driving.car?.kind === 'boat'
  if (boat) ui.tip('boat')
  else if (mode === 'driving') ui.tip('drive')
  if (mode === 'swimming') ui.tip('swim')
  if (stars(w.life.wanted) > 0) ui.tip('wanted')
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
