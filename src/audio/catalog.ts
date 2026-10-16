/*
 * Every sound file the game plays, made by scripts/audio.mjs from Epidemic Sound downloads
 * (see public/assets/CREDITS.md). Pure data.
 */

export const AUDIO_DIR = '/assets/audio/'
/** Loop files carry this many seconds of wrap-around audio past each end (scripts/audio-lib.mjs). */
export const LOOP_PAD = 0.1

/** Sound name -> how many numbered variants it has (0: a single file). */
export const SOUNDS = {
  'ui-hover': 0,
  'ui-select': 0,
  'ui-back': 0,
  'ui-map': 2,
  'ui-ping': 0,
  'ui-wanted': 0,
  'ui-wasted': 0,
  'ui-chime': 0,
  'step-concrete': 6,
  'step-run': 4,
  'step-sand': 5,
  'step-grass': 5,
  jump: 3,
  land: 0,
  'splash-big': 0,
  'splash-small': 0,
  swim: 0,
  'door-open': 0,
  'door-close': 0,
  crash: 2,
  horn: 0,
  explode: 2,
  skid: 0,
  'engine-idle': 0,
  'engine-2k': 0,
  'engine-4k': 0,
  'engine-5k': 0,
  outboard: 0,
  wake: 0,
  siren: 0,
  shot: 3,
  reload: 0,
  dry: 0,
  'impact-concrete': 0,
  'impact-metal': 0,
  casing: 3,
  yank: 0,
  grunt: 3,
  scream: 0,
  'amb-city': 0,
  'amb-night': 0,
  'amb-beach': 0,
  'amb-wind': 0,
  'amb-forest': 0,
  'amb-marina': 0,
  'amb-underwater': 0,
} as const

export type Sound = keyof typeof SOUNDS

/** The file of each variant. */
export function urls(sound: Sound): string[] {
  const n: number = SOUNDS[sound]
  if (n === 0) return [`${AUDIO_DIR}${sound}.mp3`]
  return Array.from({ length: n }, (_, i) => `${AUDIO_DIR}${sound}-${i + 1}.mp3`)
}

/** Fetched with the title screen, about 60 KB: menu clicks and the first footsteps. Everything else loads when needed. */
export const PRELOAD: Sound[] = ['ui-hover', 'ui-select', 'ui-back', 'step-concrete', 'step-run']

export interface Track {
  file: string
  title: string
  artist: string
  /** Length after processing, from scripts/audio.mjs's summary: where a station is in its playlist. */
  seconds: number
}

const track = (file: string, title: string, artist: string, seconds = 0): Track => ({
  file: `${AUDIO_DIR}${file}.mp3`,
  title,
  artist,
  seconds,
})

export const MENU_THEME = track('music-menu', 'Miami Heatwave', 'Ben Elson')
export const CHASE_THEME = track('music-chase', 'WANTED', 'BLUE STEEL')

export interface Station {
  name: string
  tracks: Track[]
}

/** In-car radio. Names are made up for this game. */
export const STATIONS: Station[] = [
  {
    name: 'Ocean Drive FM',
    tracks: [
      track(
        'radio-1-1',
        "Thinkin' About You",
        'Sven Lindvall, Bri Sarikcioglu, Daniel Fridell',
        215.66,
      ),
      track('radio-1-2', 'Unchain', 'Lupus Nocte, Zorro', 168.4),
    ],
  },
  {
    name: 'Bayside Beats',
    tracks: [
      track('radio-2-1', '$O COLD (Clean Version)', 'Baha Bank$', 143.67),
      track('radio-2-2', 'Suit and Loafers (Clean Version)', 'Nyck Caution', 159.38),
    ],
  },
  {
    name: 'Radio Calor',
    tracks: [
      track('radio-3-1', 'Latina', 'Alik, Manuelo Jersey', 190.74),
      track('radio-3-2', 'Bendito (Clean Version)', 'El Jiggy, Manuelo Jersey', 132.51),
    ],
  },
]
