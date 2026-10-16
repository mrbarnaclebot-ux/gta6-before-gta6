import { MENU_THEME } from './catalog'
import { Mixer } from './mixer'
import { Stream } from './stream'
import { wireUiSounds } from './ui-sounds'

const MENU_LEVEL = 0.75

/** What the title screen sets up and the game takes over: the mixer and the menu theme. */
export interface BootAudio {
  mixer: Mixer
  /** The world is on screen: the menu theme fades out under the first seconds of play. */
  enterGame(): void
}

/** Starts on the title screen without three.js: menu clicks now, the theme on the first click or key. */
export function bootAudio(): BootAudio {
  const mixer = new Mixer()
  const theme = new Stream(mixer)
  let playing = false
  mixer.onUnlock = () => {
    if (playing) return
    theme.load(MENU_THEME.file, true)
    theme.fadeTo(MENU_LEVEL, 2.5)
  }
  wireUiSounds(mixer)
  return {
    mixer,
    enterGame: () => {
      playing = true
      theme.fadeTo(0, 4)
    },
  }
}
