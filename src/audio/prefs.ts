/** Volume per bus, 0 to 1, and the mute switch. Saved per key in localStorage, like the other settings. */
export interface AudioPrefs {
  master: number
  music: number
  sfx: number
  ambience: number
  ui: number
  muted: boolean
}

export type VolumeKey = Exclude<keyof AudioPrefs, 'muted'>

export const VOLUME_RANGE = { min: 0, max: 1, step: 0.05 }

export const defaultAudioPrefs = (): AudioPrefs => ({
  master: 0.8,
  music: 0.6,
  sfx: 0.9,
  ambience: 0.7,
  ui: 0.6,
  muted: false,
})

/** The part of Storage this needs, so tests can pass a plain object. */
export type Store = Pick<Storage, 'getItem' | 'setItem'>

const key = (name: keyof AudioPrefs) => `vice.audio.${name}`

function browserStore(): Store | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

/** Unset, out of range, or unreadable values fall back to the default. */
export function loadAudioPrefs(store: Store | null = browserStore()): AudioPrefs {
  const prefs = defaultAudioPrefs()
  for (const name of Object.keys(prefs) as (keyof AudioPrefs)[]) {
    let raw: string | null = null
    try {
      raw = store?.getItem(key(name)) ?? null
    } catch {
      // Blocked storage reads as unset.
    }
    if (raw === null) continue
    if (name === 'muted') prefs.muted = raw === 'true'
    else {
      const v = Number(raw)
      if (raw.trim() !== '' && v >= VOLUME_RANGE.min && v <= VOLUME_RANGE.max) prefs[name] = v
    }
  }
  return prefs
}

export function saveAudioPref<K extends keyof AudioPrefs>(
  name: K,
  value: AudioPrefs[K],
  store: Store | null = browserStore(),
): void {
  try {
    store?.setItem(key(name), String(value))
  } catch {
    // Blocked storage: the setting lasts for this visit only.
  }
}

/**
 * The gain each node gets. The buses feed the master, so the graph multiplies them; mute
 * silences the master alone so every slider keeps its place.
 */
export function busGain(p: AudioPrefs, bus: VolumeKey): number {
  if (bus === 'master') return p.muted ? 0 : p.master
  return p[bus]
}
