import { describe, expect, it } from 'vitest'
import { busGain, defaultAudioPrefs, loadAudioPrefs, saveAudioPref, type Store } from './prefs'

const memory = (): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  }
}

describe('audio prefs', () => {
  it('round-trips every setting through storage', () => {
    const store = memory()
    saveAudioPref('music', 0.35, store)
    saveAudioPref('muted', true, store)
    const p = loadAudioPrefs(store)
    expect(p.music).toBe(0.35)
    expect(p.muted).toBe(true)
    expect(p.sfx).toBe(defaultAudioPrefs().sfx)
  })

  it('ignores junk and out-of-range values', () => {
    const store = memory()
    store.setItem('vice.audio.master', '7')
    store.setItem('vice.audio.ui', 'loud')
    store.setItem('vice.audio.sfx', '')
    expect(loadAudioPrefs(store)).toEqual(defaultAudioPrefs())
  })

  it('survives storage that throws', () => {
    const broken: Store = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(loadAudioPrefs(broken)).toEqual(defaultAudioPrefs())
    expect(() => saveAudioPref('master', 0.2, broken)).not.toThrow()
  })

  it('mutes at the master without moving the other sliders', () => {
    const p = { ...defaultAudioPrefs(), muted: true }
    expect(busGain(p, 'master')).toBe(0)
    expect(busGain(p, 'music')).toBe(p.music)
  })
})
