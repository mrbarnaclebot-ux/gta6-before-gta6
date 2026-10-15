import * as THREE from 'three'
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing'
import { N8AOPostPass } from 'n8ao'
import type { Quality } from '../settings'

const EXPOSURE = 1.0

/**
 * High: HDR composer with ambient occlusion, bloom, SMAA, and ACES filmic tone mapping.
 * Low: direct render with the renderer's own ACES filmic tone mapping and no post.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer
  private composer: EffectComposer | null = null

  constructor(
    canvas: HTMLCanvasElement,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      stencil: false,
      powerPreference: 'high-performance',
    })
    this.gl.outputColorSpace = THREE.SRGBColorSpace
    this.gl.toneMappingExposure = EXPOSURE
    this.gl.shadowMap.enabled = true
    this.gl.shadowMap.type = THREE.PCFShadowMap
    // Count draw calls across the whole frame (shadows, water reflection, post), not just the last pass.
    this.gl.info.autoReset = false
    window.addEventListener('resize', () => this.resize())
  }

  setQuality(q: Quality): void {
    this.composer?.dispose()
    this.composer = q === 'high' ? this.buildComposer() : null
    this.gl.toneMapping = q === 'high' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
    this.resize()
  }

  render(dt: number): void {
    this.gl.info.reset()
    if (this.composer) this.composer.render(dt)
    else this.gl.render(this.scene, this.camera)
  }

  private resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    // Retina at 1.5x cost 20+ fps on an M4 with AO and bloom; SMAA keeps 1x edges clean.
    this.gl.setPixelRatio(1)
    this.gl.setSize(w, h, false)
    this.composer?.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private buildComposer(): EffectComposer {
    const composer = new EffectComposer(this.gl, { frameBufferType: THREE.HalfFloatType })
    composer.addPass(new RenderPass(this.scene, this.camera))
    const ao = new N8AOPostPass(this.scene, this.camera, innerWidth, innerHeight)
    ao.configuration.aoRadius = 1.6
    ao.configuration.distanceFalloff = 0.6
    ao.configuration.intensity = 2.2
    ao.configuration.halfRes = true
    ao.setQualityMode('Medium')
    composer.addPass(ao)
    const bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: 0.95,
      luminanceSmoothing: 0.2,
      intensity: 0.55,
      radius: 0.7,
    })
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
    const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.35 })
    const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH })
    composer.addPass(new EffectPass(this.camera, bloom, tone, vignette))
    // SMAA after tone mapping: it detects edges on display-range colors.
    composer.addPass(new EffectPass(this.camera, smaa))
    return composer
  }
}
