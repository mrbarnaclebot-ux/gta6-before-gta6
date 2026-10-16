/*
 * The sea's shape as pure functions of position and time, so the water shader, swimming,
 * and later boats all agree on where the surface is. The shader is generated from the
 * same constants (see sea-glsl.ts), so the two cannot drift apart.
 */

const G = 9.81
const TAU = Math.PI * 2

export interface Wave {
  /** Unit direction of travel on x/z. */
  dir: [number, number]
  /** Crest to crest, meters. */
  length: number
  /** Crest height above the mean, meters. */
  amp: number
  /** 0 to 1: how sharp the crests are (Gerstner Q as a share of the no-loop limit). */
  steep: number
  phase: number
}

const unit = (x: number, z: number): [number, number] => {
  const l = Math.hypot(x, z)
  return [x / l, z / l]
}

// Gentle Atlantic swell from the east, toward the beach (the sea lies east of the city).
export const WAVES: Wave[] = [
  { dir: unit(-1, 0.12), length: 46, amp: 0.26, steep: 0.55, phase: 0 },
  { dir: unit(-0.9, -0.42), length: 27, amp: 0.13, steep: 0.6, phase: 1.7 },
  { dir: unit(-0.82, 0.55), length: 15, amp: 0.065, steep: 0.6, phase: 4.1 },
  { dir: unit(-1, -0.08), length: 8.5, amp: 0.03, steep: 0.5, phase: 2.3 },
]

/** The breaker that rolls in parallel to the shore, following the baked shore distance. */
export const SURF = {
  length: 24,
  period: 7,
  amp: 0.17,
  /** It builds up over this band of shore distance, in meters. */
  from: 110,
  to: 45,
}

export const waveNumber = (w: Wave) => TAU / w.length
/** Deep-water dispersion: longer waves travel faster. */
export const angularSpeed = (w: Wave) => Math.sqrt(G * waveNumber(w))
/** Gerstner Q, capped so the summed crests never loop over themselves. */
export const gerstnerQ = (w: Wave) => w.steep / (waveNumber(w) * w.amp * WAVES.length)

/** What the baked sea field says about a spot: wave scale (calm canal, shallows) and signed shore distance. */
export interface SeaSample {
  scale: number
  /** Meters to the nearest land, negative inland. */
  shore: number
}

export const OPEN_SEA: SeaSample = { scale: 1, shore: 1e4 }

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Breaks the surf's crest lines up along the shore, in radians. */
export const surfWobble = (x: number, z: number) =>
  0.9 * Math.sin(0.021 * x + 0.034 * z) + 0.6 * Math.sin(0.047 * z - 0.013 * x)

/** Surf crest phase in radians; the crest (cos = 1) moves shoreward as time runs. */
export function surfPhase(x: number, z: number, t: number, shore: number): number {
  return TAU * (shore / SURF.length + t / SURF.period) + surfWobble(x, z)
}

/** Surf height: a peaked crest and a long flat trough, zero on average over a cycle. */
export function surfHeight(x: number, z: number, t: number, s: SeaSample): number {
  const build = smoothstep(SURF.from, SURF.to, s.shore)
  if (build === 0) return 0
  const c = 0.5 + 0.5 * Math.cos(surfPhase(x, z, t, s.shore))
  // The breaker spends itself in the shallows: only a swash runs up the sand.
  return SURF.amp * build * s.scale * (2 * c * c * c - 0.625)
}

/** Where the surface point that started at (x, z) has moved: [dx, dy, dz]. */
export function displace(x: number, z: number, t: number, s: SeaSample): [number, number, number] {
  let dx = 0
  let dy = surfHeight(x, z, t, s)
  let dz = 0
  for (const w of WAVES) {
    const k = waveNumber(w)
    const a = w.amp * s.scale
    const theta = k * (w.dir[0] * x + w.dir[1] * z) - angularSpeed(w) * t + w.phase
    const q = gerstnerQ(w) * a * Math.cos(theta)
    dx += q * w.dir[0]
    dz += q * w.dir[1]
    dy += a * Math.sin(theta)
  }
  return [dx, dy, dz]
}

/**
 * Height of the sea surface above its mean at (x, z) and time t. Gerstner waves also push
 * points sideways, so this finds the rest point that lands on (x, z) by fixed-point
 * iteration first: five steps get within a millimeter for these gentle waves.
 */
export function waveHeightAt(
  x: number,
  z: number,
  t: number,
  at: (x: number, z: number) => SeaSample = () => OPEN_SEA,
): number {
  let px = x
  let pz = z
  for (let i = 0; i < 5; i++) {
    const [dx, , dz] = displace(px, pz, t, at(px, pz))
    px = x - dx
    pz = z - dz
  }
  return displace(px, pz, t, at(px, pz))[1]
}

/** The highest any crest can reach above the mean, at full scale. */
export const MAX_WAVE = WAVES.reduce((s, w) => s + w.amp, 0) + SURF.amp * 1.375
