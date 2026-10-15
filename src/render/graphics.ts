/** The values each multiple-choice option takes, cheapest first. The settings panel lists these. */
export const CHOICES = {
  distance: ['near', 'medium', 'far', 'ultra'],
  shadows: ['low', 'medium', 'high', 'ultra'],
  ao: ['off', 'medium', 'high', 'ultra'],
  reflections: ['low', 'medium', 'high', 'ultra'],
} as const

export type Preset = 'low' | 'medium' | 'high' | 'ultra'
export type Tier = (typeof CHOICES.shadows)[number]
export type Distance = (typeof CHOICES.distance)[number]

/** Every graphics option, as plain data. A preset is one of these; Custom is any other mix. */
export interface Graphics {
  /** Fraction of the window's CSS pixels rendered, 0.5 to 1. */
  renderScale: number
  /** Lower the scale on its own to hold 60 fps. */
  dynamicRes: boolean
  distance: Distance
  shadows: Tier
  ao: (typeof CHOICES.ao)[number]
  /** Water mirror size. */
  reflections: Tier
  smaa: boolean
  bloom: boolean
  dof: boolean
  motionBlur: boolean
  godRays: boolean
  lensFlare: boolean
  /** Film grain and a hint of chromatic aberration. */
  filmGrain: boolean
}

export const PRESETS: Record<Preset, Graphics> = {
  low: {
    renderScale: 1,
    dynamicRes: false,
    distance: 'near',
    shadows: 'low',
    ao: 'off',
    reflections: 'low',
    smaa: false,
    bloom: false,
    dof: false,
    motionBlur: false,
    godRays: false,
    lensFlare: false,
    filmGrain: false,
  },
  medium: {
    renderScale: 1,
    dynamicRes: false,
    distance: 'medium',
    shadows: 'medium',
    ao: 'medium',
    reflections: 'medium',
    smaa: true,
    bloom: true,
    dof: true,
    motionBlur: false,
    godRays: false,
    lensFlare: false,
    filmGrain: false,
  },
  high: {
    renderScale: 1,
    dynamicRes: false,
    distance: 'far',
    shadows: 'high',
    ao: 'high',
    reflections: 'high',
    smaa: true,
    bloom: true,
    dof: true,
    motionBlur: true,
    godRays: true,
    lensFlare: true,
    filmGrain: false,
  },
  ultra: {
    renderScale: 1,
    dynamicRes: false,
    distance: 'ultra',
    shadows: 'ultra',
    ao: 'ultra',
    reflections: 'ultra',
    smaa: true,
    bloom: true,
    dof: true,
    motionBlur: true,
    godRays: true,
    lensFlare: true,
    filmGrain: true,
  },
}

export const PRESET_NAMES = Object.keys(PRESETS) as Preset[]
export const DEFAULT_PRESET: Preset = 'high'

/** The preset these settings match exactly, or 'custom'. */
export function presetOf(g: Graphics): Preset | 'custom' {
  const same = (p: Graphics) => (Object.keys(p) as (keyof Graphics)[]).every((k) => p[k] === g[k])
  return PRESET_NAMES.find((n) => same(PRESETS[n])) ?? 'custom'
}

/** Post-processing is skipped entirely when nothing in it is on: the cheapest path. */
export function needsComposer(g: Graphics): boolean {
  const { ao, smaa, bloom, dof, motionBlur, godRays, lensFlare, filmGrain } = g
  return ao !== 'off' || smaa || bloom || dof || motionBlur || godRays || lensFlare || filmGrain
}

/**
 * Saved settings merged over a base, keeping only known keys whose type matches,
 * so a stale or hand-edited save can never break the renderer.
 */
export function sanitize(saved: unknown, base: Graphics): Graphics {
  const out = { ...base }
  if (!saved || typeof saved !== 'object') return out
  const s = saved as Record<string, unknown>
  for (const k of Object.keys(base) as (keyof Graphics)[]) {
    const choices = (CHOICES as Record<string, readonly string[]>)[k]
    const ok = choices ? choices.includes(s[k] as string) : typeof s[k] === typeof base[k]
    if (ok) Object.assign(out, { [k]: s[k] })
  }
  out.renderScale = Math.min(1, Math.max(0.5, Number(out.renderScale) || 1))
  return out
}

const KEY = 'vice.graphics'

/** URL ?quality=<preset> wins (tests, slow machines), then the saved settings, then the default. */
export function loadGraphics(search = location.search): Graphics {
  const q = new URLSearchParams(search).get('quality')
  if (q && q in PRESETS) return { ...PRESETS[q as Preset] }
  try {
    const raw = localStorage.getItem(KEY)
    return sanitize(raw ? JSON.parse(raw) : null, PRESETS[DEFAULT_PRESET])
  } catch {
    return { ...PRESETS[DEFAULT_PRESET] }
  }
}

export function saveGraphics(g: Graphics): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(g))
  } catch {
    // Private mode or blocked storage: the settings last for this visit only.
  }
}
