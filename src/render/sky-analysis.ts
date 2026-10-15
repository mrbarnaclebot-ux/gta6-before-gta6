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
