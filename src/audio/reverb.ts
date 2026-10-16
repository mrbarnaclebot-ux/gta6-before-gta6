/**
 * A street-echo impulse response: a few early slaps off the buildings, then a noise tail
 * that decays and darkens. Made once at startup instead of shipping an IR file.
 */
export function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate
  const n = Math.floor(rate * seconds)
  const ir = ctx.createBuffer(2, n, rate)
  // Slaps off facades across the street, in seconds and gain; a little different per ear.
  const slaps = [
    [0.021, 0.5],
    [0.047, 0.35],
    [0.083, 0.28],
    [0.131, 0.18],
  ]
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch)
    let low = 0
    for (let i = 0; i < n; i++) {
      const t = i / rate
      // One-pole low-pass that closes over time: the tail loses its highs like a real one.
      const k = 0.6 * Math.exp(-t * 2.5) + 0.05
      low += k * (Math.random() * 2 - 1 - low)
      data[i] = low * Math.exp(-t * 3.2) * 0.5
    }
    for (const [at, g] of slaps) data[Math.floor((at + ch * 0.004) * rate)] += g
  }
  return ir
}
