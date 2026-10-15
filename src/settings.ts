/** Display and control preferences. Graphics settings live in render/graphics.ts. */
export interface Prefs {
  /** Mouse look speed as a multiple of the default. */
  sensitivity: number
  invertY: boolean
  /** Vertical field of view on foot, in degrees; the car's speed widens it from here. */
  fov: number
  showFps: boolean
  /** HUD size as a multiple of the default. */
  hudScale: number
}

export type Range = { min: number; max: number; step: number }
export const RANGES: Record<'sensitivity' | 'fov' | 'hudScale', Range> = {
  sensitivity: { min: 0.3, max: 3, step: 0.1 },
  fov: { min: 45, max: 80, step: 1 },
  hudScale: { min: 0.75, max: 1.25, step: 0.05 },
}

export function defaultPrefs(): Prefs {
  const debug = import.meta.env.DEV || location.search.includes('debug')
  return { sensitivity: 1, invertY: false, fov: 55, showFps: debug, hudScale: 1 }
}

const key = (name: keyof Prefs) => `vice.${name}`

/** Each preference is its own localStorage key; unset, out of range, or unreadable means default. */
export function loadPrefs(): Prefs {
  const prefs = defaultPrefs()
  for (const name of Object.keys(prefs) as (keyof Prefs)[]) {
    const raw = read(name)
    if (raw === null) continue
    if (typeof prefs[name] === 'boolean') Object.assign(prefs, { [name]: raw === 'true' })
    else {
      const v = Number(raw)
      const r = RANGES[name as keyof typeof RANGES]
      if (v >= r.min && v <= r.max) Object.assign(prefs, { [name]: v })
    }
  }
  return prefs
}

function read(name: keyof Prefs): string | null {
  try {
    return localStorage.getItem(key(name))
  } catch {
    return null
  }
}

export function savePref<K extends keyof Prefs>(name: K, value: Prefs[K]): void {
  try {
    localStorage.setItem(key(name), String(value))
  } catch {
    // Blocked storage: the setting lasts for this visit only.
  }
}
