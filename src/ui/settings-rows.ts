import { CHOICES, type Graphics } from '../render/graphics'
import { RANGES, type Prefs, type Range } from '../settings'

/** One settings row: a label, a one-line hint (mostly what it costs), and its control. */
export type Row = { label: string; hint: string } & (
  | { kind: 'choice'; key: string; options: { value: string; label: string }[] }
  | { kind: 'toggle'; key: string }
  | ({ kind: 'range'; key: string; format: (v: number) => string } & Range)
)

const title = (v: string) => v[0].toUpperCase() + v.slice(1)
const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: title(value) }))
const percent = (v: number) => `${Math.round(v * 100)}%`

export const PRESET_ROW: Row = {
  kind: 'choice',
  key: 'preset',
  label: 'Quality preset',
  hint: 'Sets everything below. Change any one option and it becomes Custom.',
  options: [...options(['low', 'medium', 'high', 'ultra']), { value: 'custom', label: 'Custom' }],
}

type GraphicsRow = Row & { key: keyof Graphics }

export const GRAPHICS_ROWS: GraphicsRow[] = [
  {
    kind: 'range',
    key: 'renderScale',
    label: 'Render scale',
    hint: 'Pixels drawn per screen pixel. The biggest single cost.',
    min: 0.5,
    max: 1,
    step: 0.05,
    format: percent,
  },
  {
    kind: 'toggle',
    key: 'dynamicRes',
    label: 'Dynamic resolution',
    hint: 'Lowers the render scale on its own to hold 60 fps.',
  },
  {
    kind: 'choice',
    key: 'distance',
    label: 'Render distance',
    hint: 'How far buildings, plants, cars, and shadows reach. Medium cost.',
    options: options(CHOICES.distance),
  },
  {
    kind: 'choice',
    key: 'shadows',
    label: 'Shadows',
    hint: 'Low is one map around you; higher adds sharper cascades. High cost.',
    options: options(CHOICES.shadows),
  },
  {
    kind: 'choice',
    key: 'ao',
    label: 'Ambient occlusion',
    hint: 'Soft shadows in corners and under cars. Medium cost; Ultra is full resolution.',
    options: options(CHOICES.ao),
  },
  {
    kind: 'choice',
    key: 'reflections',
    label: 'Water reflections',
    hint: 'Sharpness of the mirror on the sea and canal. Medium cost near water.',
    options: options(CHOICES.reflections),
  },
  {
    kind: 'toggle',
    key: 'smaa',
    label: 'Anti-aliasing (SMAA)',
    hint: 'Smooths jagged edges. Low cost.',
  },
  {
    kind: 'toggle',
    key: 'dof',
    label: 'Depth of field',
    hint: 'Softens the far background, more while aiming. Low cost.',
  },
  {
    kind: 'toggle',
    key: 'motionBlur',
    label: 'Motion blur',
    hint: 'Blur from camera motion, strongest in a fast car. Low cost.',
  },
  {
    kind: 'toggle',
    key: 'godRays',
    label: 'God rays',
    hint: 'Sunbeams past buildings and palms. Medium cost.',
  },
  {
    kind: 'toggle',
    key: 'bloom',
    label: 'Bloom',
    hint: 'Glow around the sun, lamps, and neon. Low cost.',
  },
  {
    kind: 'toggle',
    key: 'lensFlare',
    label: 'Lens flare',
    hint: 'A faint flare when facing the sun. Very low cost.',
  },
  {
    kind: 'toggle',
    key: 'filmGrain',
    label: 'Film grain',
    hint: 'Grain and a hint of color fringing at the edges. Very low cost.',
  },
]

type PrefRow = Row & { key: keyof Prefs }

export const DISPLAY_ROWS: PrefRow[] = [
  {
    kind: 'range',
    key: 'fov',
    label: 'Field of view',
    hint: 'Wider shows more around you; narrower looks more cinematic.',
    ...RANGES.fov,
    format: (v) => `${v}°`,
  },
  { kind: 'toggle', key: 'showFps', label: 'Show FPS', hint: 'Frame rate in the top corner.' },
  {
    kind: 'range',
    key: 'hudScale',
    label: 'HUD scale',
    hint: 'Size of the minimap, ammo, speed, and wanted stars.',
    ...RANGES.hudScale,
    format: percent,
  },
]

export const CONTROL_ROWS: PrefRow[] = [
  {
    kind: 'range',
    key: 'sensitivity',
    label: 'Mouse sensitivity',
    hint: 'Look speed. Aiming is a little slower on purpose.',
    ...RANGES.sensitivity,
    format: (v) => `${v.toFixed(1)}x`,
  },
  { kind: 'toggle', key: 'invertY', label: 'Invert Y', hint: 'Mouse up looks down.' },
]
