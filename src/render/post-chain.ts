import * as THREE from 'three'
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  type Effect,
  EffectComposer,
  EffectPass,
  GodRaysEffect,
  LUT3DEffect,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing'
import { aoPass } from './ao-pass'
import { DistanceBlurEffect } from './distance-blur'
import { gradeLut } from './grade'
import type { Graphics } from './graphics'
import { LensFlareEffect } from './lens-flare'
import { MotionBlurEffect } from './motion-blur'
import { SsrEffect } from './ssr'
import type { SunFx } from './sun-fx'

/** The composer plus the effects that need per-frame input. Absent when switched off. */
export interface Chain {
  composer: EffectComposer
  dof?: DistanceBlurEffect
  blur?: MotionBlurEffect
  flare?: LensFlareEffect
  rays?: SunRays
}

interface Ctx {
  gl: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  sun: SunFx
}

// Built once: the LUT costs a few ms of math, and it never changes.
let lut: THREE.Texture | null = null

/** God rays that skip their three passes (and hide) while the sun cannot shine into view. */
export class SunRays extends GodRaysEffect {
  active = true

  override update(r: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget, dt?: number): void {
    this.blendMode.opacity.value = this.active ? 1 : 0
    if (this.active) super.update(r, input, dt)
  }
}

function godRays(c: Ctx): SunRays {
  return new SunRays(c.camera, c.sun.disc, {
    blendFunction: BlendFunction.SCREEN,
    samples: 32,
    density: 0.86,
    decay: 0.92,
    weight: 0.22,
    exposure: 0.32,
    clampMax: 0.7,
    // A third of the resolution and no extra blur pass: the radial smear is soft already.
    resolutionScale: 0.33,
    blur: false,
  })
}

/** HDR effects first, then tone mapping, then display-space grading. */
function mainEffects(c: Ctx, g: Graphics, out: Chain): Effect[] {
  const fx: Effect[] = []
  if (g.dof) {
    // Focus follows the player or the crosshair (see Renderer.frame).
    fx.push((out.dof = new DistanceBlurEffect(c.camera)))
  }
  if (g.godRays) fx.push((out.rays = godRays(c)))
  if (g.bloom) {
    const radius = 0.7
    fx.push(
      new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.95, intensity: 0.55, radius }),
    )
  }
  if (g.lensFlare) fx.push((out.flare = new LensFlareEffect()))
  fx.push(new ToneMappingEffect({ mode: ToneMappingMode.AGX }))
  fx.push(new LUT3DEffect((lut ??= gradeLut())))
  fx.push(new VignetteEffect({ offset: 0.3, darkness: 0.4 }))
  return fx
}

function filmEffects(): Effect[] {
  const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false })
  grain.blendMode.opacity.value = 0.12
  const ca = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.0006, 0.0004),
    radialModulation: true,
    modulationOffset: 0.35,
  })
  return [ca, grain]
}

/** Screen-space reflections come with the High and Ultra reflection settings. */
export const ssrOn = (g: Graphics) => g.reflections === 'high' || g.reflections === 'ultra'

/** Builds the post-processing chain for these settings. */
export function buildChain(c: Ctx, g: Graphics, w: number, h: number): Chain {
  const composer = new EffectComposer(c.gl, { frameBufferType: THREE.HalfFloatType })
  const out: Chain = { composer }
  composer.addPass(new RenderPass(c.scene, c.camera))
  // First, while the alpha still holds how mirror-like each pixel is (ssr.ts).
  if (ssrOn(g)) composer.addPass(new EffectPass(c.camera, new SsrEffect(c.camera)))
  if (g.ao !== 'off') composer.addPass(aoPass(c.scene, c.camera, w, h, g.ao))
  if (g.motionBlur)
    composer.addPass(new EffectPass(c.camera, (out.blur = new MotionBlurEffect(c.camera))))
  composer.addPass(new EffectPass(c.camera, ...mainEffects(c, g, out)))
  // SMAA after tone mapping: it detects edges on display-range colors.
  if (g.smaa)
    composer.addPass(new EffectPass(c.camera, new SMAAEffect({ preset: SMAAPreset.HIGH })))
  if (g.filmGrain) composer.addPass(new EffectPass(c.camera, ...filmEffects()))
  return out
}
