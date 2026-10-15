import { describe, expect, it } from 'vitest'
import { loadGraphics, needsComposer, PRESET_NAMES, PRESETS, presetOf, sanitize } from './graphics'

describe('graphics presets', () => {
  it('recognizes each preset and calls any other mix Custom', () => {
    for (const name of PRESET_NAMES) expect(presetOf({ ...PRESETS[name] })).toBe(name)
    expect(presetOf({ ...PRESETS.high, bloom: false })).toBe('custom')
  })

  it('climbs in cost from Low to Ultra', () => {
    expect(PRESETS.low.shadows).toBe('low')
    expect(PRESETS.low.dof).toBe(false)
    expect(PRESETS.medium.motionBlur).toBe(false)
    expect(PRESETS.high.motionBlur).toBe(true)
    expect(PRESETS.ultra.ao).toBe('ultra')
    expect(PRESETS.ultra.filmGrain).toBe(true)
    expect(PRESETS.high.filmGrain).toBe(false)
  })

  it('skips post-processing only when every post effect is off', () => {
    expect(needsComposer(PRESETS.low)).toBe(false)
    expect(needsComposer({ ...PRESETS.low, lensFlare: true })).toBe(true)
    expect(needsComposer(PRESETS.medium)).toBe(true)
  })

  it('keeps valid saved values and drops broken ones', () => {
    const saved = { shadows: 'ultra', bloom: false, ao: 'bogus', dof: 'yes', renderScale: 7, x: 1 }
    const g = sanitize(saved, PRESETS.high)
    expect(g.shadows).toBe('ultra')
    expect(g.bloom).toBe(false)
    expect(g.ao).toBe(PRESETS.high.ao)
    expect(g.dof).toBe(PRESETS.high.dof)
    expect(g.renderScale).toBe(1)
    expect('x' in g).toBe(false)
    expect(sanitize(null, PRESETS.low)).toEqual(PRESETS.low)
  })

  it('lets ?quality= pick a preset for the visit', () => {
    expect(loadGraphics('?quality=low')).toEqual(PRESETS.low)
    expect(loadGraphics('?quality=ultra')).toEqual(PRESETS.ultra)
    // No storage in this environment: falls back to the default preset.
    expect(presetOf(loadGraphics('?quality=nope'))).not.toBe('custom')
    expect(presetOf(loadGraphics('?quality=toString'))).not.toBe('custom')
  })
})
