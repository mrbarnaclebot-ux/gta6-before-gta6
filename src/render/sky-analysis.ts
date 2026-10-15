/**
 * Find the sun in an equirectangular HDR (RGBA float rows, top row first) so the
 * shadow-casting light lines up with the sun painted in the sky.
 * Returns a unit vector pointing from the ground toward the sun, in three.js
 * equirect convention (u = atan2(z, x) / 2pi + 0.5).
 */
export function sunDirection(
  data: ArrayLike<number>,
  width: number,
  height: number,
): [number, number, number] {
  let best = -1
  let bestIndex = 0
  // Only the upper half: a bright reflection below the horizon is never the sun.
  for (let i = 0; i < width * (height >> 1); i++) {
    const lum = data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722
    if (lum > best) {
      best = lum
      bestIndex = i
    }
  }
  const u = ((bestIndex % width) + 0.5) / width
  const v = 1 - (Math.floor(bestIndex / width) + 0.5) / height
  const phi = (u - 0.5) * Math.PI * 2
  const elevation = (v - 0.5) * Math.PI
  const c = Math.cos(elevation)
  return [Math.cos(phi) * c, Math.sin(elevation), Math.sin(phi) * c]
}

/** Average color of the band just above the horizon: the fog color that hides the ground edge. */
export function horizonColor(
  data: ArrayLike<number>,
  width: number,
  height: number,
): [number, number, number] {
  const row = Math.floor(height * 0.47)
  const sum = [0, 0, 0]
  for (let x = 0; x < width; x++) {
    for (let c = 0; c < 3; c++) sum[c] += data[(row * width + x) * 4 + c]
  }
  return [sum[0] / width, sum[1] / width, sum[2] / width]
}

// three.js ACESFilmicToneMapping, matrices column-major as in its GLSL.
const ACES_IN = [
  [0.59719, 0.076, 0.0284],
  [0.35458, 0.90834, 0.13383],
  [0.04823, 0.01566, 0.83777],
]
const ACES_OUT = [
  [1.60475, -0.10208, -0.00327],
  [-0.53108, 1.10813, -0.07276],
  [-0.07367, -0.00605, 1.07602],
]
const mul = (m: number[][], v: number[]) =>
  [0, 1, 2].map((i) => m[0][i] * v[0] + m[1][i] * v[1] + m[2][i] * v[2])
const fit = (v: number) =>
  (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081)

/** three.js ACES filmic tone mapping at exposure 1, applied to a linear RGB color. */
export function acesFilmic(rgb: number[]): number[] {
  const v = mul(
    ACES_IN,
    rgb.map((c) => c / 0.6),
  ).map(fit)
  return mul(ACES_OUT, v).map((c) => Math.min(1, Math.max(0, c)))
}
