import * as THREE from 'three'
import { needsComposer, type Graphics } from './graphics'
import { buildChain, type Chain } from './post-chain'
import { SunFx } from './sun-fx'

const EXPOSURE = 1.0
// Depth of field in normal play (a soft far background) and when aiming (a tight focus).
const DOF_CALM = { range: 160, strength: 0.75 }
const DOF_AIM = { range: 30, strength: 1 }
// Motion blur on foot is a hint; in a car it grows with speed, full at this many m/s.
const BLUR_FOOT = 0.3
const BLUR_TOP_SPEED = 30

/** What the effects follow each frame. */
export interface FrameView {
  /** Where the focus sits: the player's chest, or what the crosshair is on while aiming. */
  focus: THREE.Vector3
  /** 0 to 1, eased: how far into aiming the camera is. */
  aim: number
  /** Forward speed of the driven car in m/s, 0 on foot. */
  speed: number
}

const postKey = (g: Graphics) =>
  [g.ao, g.smaa, g.bloom, g.dof, g.motionBlur, g.godRays, g.lensFlare, g.filmGrain].join()

/**
 * The WebGL renderer and its post-processing chain, rebuilt live when a setting needs it.
 * With every post effect off it renders straight to the screen with ACES in the renderer.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer
  readonly sun = new SunFx()
  private chain: Chain | null = null
  private key = ''
  private scale = 1

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

  /** True when post-processing (and so HDR fog and tone mapping in post) is in use. */
  get post(): boolean {
    return this.chain !== null
  }

  apply(g: Graphics): void {
    const key = needsComposer(g) ? postKey(g) : ''
    if (key !== this.key) {
      this.key = key
      this.chain?.composer.dispose()
      const ctx = { gl: this.gl, scene: this.scene, camera: this.camera, sun: this.sun }
      this.chain = key ? buildChain(ctx, g, innerWidth, innerHeight) : null
      this.gl.toneMapping = key ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
    }
    this.scale = g.renderScale
    this.resize()
  }

  /** Render resolution as a fraction of the window, for dynamic resolution. */
  setScale(s: number): void {
    if (Math.abs(s - this.scale) < 0.01) return
    this.scale = s
    this.resize()
  }

  /** Points depth of field, motion blur, god rays, and the lens flare at this frame. */
  frame(v: FrameView): void {
    const c = this.chain
    if (!c) return
    if (c.dof) {
      const f = c.dof.focus
      f.distance = this.camera.position.distanceTo(v.focus)
      f.range = THREE.MathUtils.lerp(DOF_CALM.range, DOF_AIM.range, v.aim)
      f.strength = THREE.MathUtils.lerp(DOF_CALM.strength, DOF_AIM.strength, v.aim)
    }
    if (c.blur) c.blur.intensity = Math.max(BLUR_FOOT, Math.min(1, v.speed / BLUR_TOP_SPEED))
    c.flare?.set(this.sun.uv, this.sun.flare, this.sun.tint)
    if (c.rays) c.rays.active = this.sun.rays
  }

  render(dt: number): void {
    this.gl.info.reset()
    if (this.chain) this.chain.composer.render(dt)
    else this.gl.render(this.scene, this.camera)
  }

  private resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    // CSS pixels, never Retina: 1.5x cost 20+ fps on an M4 with AO and bloom; SMAA keeps 1x edges clean.
    this.gl.setPixelRatio(this.scale)
    this.gl.setSize(w, h, false)
    this.chain?.composer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }
}
