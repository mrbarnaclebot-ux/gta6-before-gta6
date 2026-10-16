/** Seeded 2D gradient noise and fractal sums of it: the same seed gives the same hills every load. */

function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 982451653)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

function grad(ix: number, iz: number, seed: number, dx: number, dz: number): number {
  const a = (hash(ix, iz, seed) / 4294967296) * Math.PI * 2
  return Math.cos(a) * dx + Math.sin(a) * dz
}

/** Perlin-style gradient noise, roughly in [-0.7, 0.7], smooth everywhere. */
export function noise2(x: number, z: number, seed = 0): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const u = fade(fx)
  const v = fade(fz)
  const a = grad(ix, iz, seed, fx, fz)
  const b = grad(ix + 1, iz, seed, fx - 1, fz)
  const c = grad(ix, iz + 1, seed, fx, fz - 1)
  const d = grad(ix + 1, iz + 1, seed, fx - 1, fz - 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** Fractal sum of `octaves` noise layers, each twice as fine and half as strong; about [-1, 1]. */
export function fbm(x: number, z: number, seed = 0, octaves = 4): number {
  let sum = 0
  let amp = 1
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(x, z, seed + o * 17)
    norm += amp
    amp *= 0.5
    x *= 2.03
    z *= 2.03
  }
  return (sum / norm) * 1.6
}

/** Ridged fractal noise in [0, 1]: sharp crests, like eroded hill tops. */
export function ridged(x: number, z: number, seed = 0, octaves = 4): number {
  let sum = 0
  let amp = 0.5
  for (let o = 0; o < octaves; o++) {
    sum += amp * (1 - Math.abs(noise2(x, z, seed + o * 31) * 1.4)) ** 2
    amp *= 0.5
    x *= 2.1
    z *= 2.1
  }
  return Math.min(1, sum)
}

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
