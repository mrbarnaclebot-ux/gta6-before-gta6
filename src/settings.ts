export type Quality = 'low' | 'high'

const KEY = 'vice.quality'

/** URL ?quality= wins (handy for tests and slow machines), then the saved choice, then high. */
export function loadQuality(): Quality {
  const fromUrl = new URLSearchParams(location.search).get('quality')
  if (fromUrl === 'low' || fromUrl === 'high') return fromUrl
  try {
    return localStorage.getItem(KEY) === 'low' ? 'low' : 'high'
  } catch {
    return 'high'
  }
}

export function saveQuality(q: Quality): void {
  try {
    localStorage.setItem(KEY, q)
  } catch {
    // Private mode or blocked storage: the setting just does not persist.
  }
}

const SENSITIVITY_KEY = 'vice.sensitivity'
export const SENSITIVITY_RANGE = { min: 0.3, max: 3, step: 0.1 }

/** Mouse look speed as a multiple of the default; 1 if unset or unreadable. */
export function loadSensitivity(): number {
  try {
    const v = Number(localStorage.getItem(SENSITIVITY_KEY))
    const { min, max } = SENSITIVITY_RANGE
    return v >= min && v <= max ? v : 1
  } catch {
    return 1
  }
}

export function saveSensitivity(v: number): void {
  try {
    localStorage.setItem(SENSITIVITY_KEY, String(v))
  } catch {
    // Blocked storage: the setting lasts for this visit only.
  }
}
