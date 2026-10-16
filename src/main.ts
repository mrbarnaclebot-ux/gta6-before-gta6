import './style.css'
import './ui/menu.css'
import './ui/credits.css'
import './ui/loading.css'
import './ui/hud.css'
import './ui/hud-panels.css'
import './ui/death.css'
import './ui/worldmap.css'
import './ui/pause.css'
import './ui/settings.css'
import { bootAudio } from './audio/boot'
import { Input } from './input/input'
import { loadGraphics, saveGraphics } from './render/graphics'
import { loadPrefs, savePref } from './settings'
import { Loading } from './ui/loading'
import { MainMenu } from './ui/menu'
import { PauseMenu } from './ui/pause'

const canvas = document.getElementById('view') as HTMLCanvasElement
const status = document.getElementById('status') as HTMLElement
const playButton = document.getElementById('play') as HTMLButtonElement
const input = new Input(canvas)
const audio = bootAudio()

// Built here so Settings works on the title screen; the game takes it over on start.
const pause = new PauseMenu(
  { graphics: loadGraphics(), prefs: loadPrefs(), audio: audio.mixer.prefs },
  {
    onGraphics: saveGraphics,
    onPref: savePref,
    onAudio: (name, value) => audio.mixer.set(name, value),
    onResume: () => menu.refocus(),
    autoOpen: () => false,
  },
)
const menu = new MainMenu({ play, settings: (tab) => pause.show(tab) })
const loading = new Loading()

// Esc closes the settings on the title screen; in game the loop handles it.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && pause.open && !pause.playing) pause.hide(false)
})

// Fetch the engine once the menu is up, so Play rarely waits on it. Lazy so the menu paints
// before three.js and the physics WASM download; a failure here retries on Play.
addEventListener('load', () => setTimeout(() => import('./game').catch(() => {}), 800))

async function play(): Promise<void> {
  playButton.disabled = true
  status.textContent = ''
  input.lockPointer()
  try {
    await loading.show()
    menu.root.hidden = true
    const { startGame } = await import('./game')
    loading.finish('code')
    await startGame(canvas, input, { pause, loading, audio })
    input.reset()
    canvas.focus()
  } catch (err) {
    console.error(err)
    loading.close()
    menu.root.hidden = false
    status.textContent = 'Could not start. Your browser may not support WebGL2.'
    playButton.disabled = false
    menu.refocus()
  }
}
