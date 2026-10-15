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
