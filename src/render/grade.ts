import { LookupTexture } from 'postprocessing'

type RGB = [number, number, number]

// The trailer look: warm highlights, teal-leaning shadows, punchy contrast, rich color.
// AgX (post-chain.ts) keeps white facades and clouds from clipping but mutes color, so the
// grade puts back more saturation and contrast than it needed after ACES.
const SATURATION = 1.4
const CONTRAST = 0.28
const SHADOW_TINT: RGB = [-0.03, 0.012, 0.04]
const HIGHLIGHT_TINT: RGB = [0.045, 0.012, -0.035]
const LUT_SIZE = 32

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** The color grade for one display-encoded (sRGB, 0 to 1) color. Baked into a 3D LUT once. */
export function grade(c: RGB): RGB {
  const l = luma(c)
  return c.map((v, i) => {
    const sat = l + (v - l) * SATURATION
    // An S-curve: smoothstep pulls darks down and lights up; mixing keeps it gentle.
    const s = clamp01(sat)
    const curved = sat + (s * s * (3 - 2 * s) - s) * CONTRAST * 2
    // Split toning, zero at pure black and white so neither picks up a cast.
    const tint = SHADOW_TINT[i] * (1 - l) ** 2 + HIGHLIGHT_TINT[i] * l * l
    return clamp01(curved + tint * 4 * l * (1 - l))
  }) as RGB
}

/**
 * A 32-cube lookup table holding `grade` for every color. LUT3DEffect feeds it sRGB-encoded
 * input and passes its sRGB output down the chain as such, so the data stays plain floats.
 */
export function gradeLut(): LookupTexture {
  const lut = LookupTexture.createNeutral(LUT_SIZE)
  const data = lut.image.data as Float32Array
  for (let i = 0; i < data.length; i += 4) {
    const out = grade([data[i], data[i + 1], data[i + 2]])
    data.set(out, i)
  }
  lut.needsUpdate = true
  return lut
}
