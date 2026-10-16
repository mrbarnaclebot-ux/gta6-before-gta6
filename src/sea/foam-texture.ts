import * as THREE from 'three'

const SIZE = 256

/** Tileable gap between the nearest and second-nearest of `n` x `n` jittered points: 0 on cell borders. */
function worley(n: number, seed: number): Float32Array {
  const pts = new Float32Array(n * n * 2)
  let s = seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < pts.length; i++) pts[i] = rnd()
  const out = new Float32Array(SIZE * SIZE)
  const cell = SIZE / n
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cx = Math.floor(x / cell)
      const cy = Math.floor(y / cell)
      let best = 9
      let next = 9
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = (((cy + dy + n) % n) * n + ((cx + dx + n) % n)) * 2
          const px = (cx + dx + pts[i]) * cell
          const py = (cy + dy + pts[i + 1]) * cell
          const d = Math.hypot(px - x, py - y) / cell
          if (d < best) [next, best] = [best, d]
          else next = Math.min(next, d)
        }
      }
      out[y * SIZE + x] = next - best
    }
  }
  return out
}

/**
 * Sea foam as a tileable lace: bright strands along the borders of large cells, with
 * smaller bubbles between, so thresholding it leaves a net of foam with holes, not blobs. Generated at load:
 * no CC0 foam texture was in the asset set, and this one costs 50 ms and no download.
 */
export function foamTexture(): THREE.DataTexture {
  const big = worley(10, 7)
  const small = worley(28, 19)
  const data = new Uint8Array(SIZE * SIZE)
  for (let i = 0; i < data.length; i++) {
    const strands = 1 - Math.min(big[i] / 0.45, 1)
    const bubbles = 1 - Math.min(small[i] / 0.35, 1)
    data[i] = Math.round(Math.min(1, 0.7 * strands + 0.45 * bubbles) * 255)
  }
  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RedFormat, THREE.UnsignedByteType)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  return tex
}
