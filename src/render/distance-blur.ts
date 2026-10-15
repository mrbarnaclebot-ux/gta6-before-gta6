import * as THREE from 'three'
import { Effect, EffectAttribute, KawaseBlurPass, KernelSize, ShaderPass } from 'postprocessing'

/** How far past the focus the blur ramps to full (meters), and how strong full is. */
export interface Focus {
  distance: number
  range: number
  strength: number
}

const COC = /* glsl */ `
float farCoc(float dist) {
  return smoothstep(0.0, range, dist - focus) * strength;
}
`

// Only what lies behind the focus goes into the blur, weighted by how blurred it should be,
// so a sharp subject never bleeds into the soft background around it (no halos).
const MASK_FRAGMENT = /* glsl */ `
#include <packing>
uniform sampler2D inputBuffer;
uniform highp sampler2D depthBuffer;
uniform float cameraNear;
uniform float cameraFar;
uniform float focus;
uniform float range;
uniform float strength;
varying vec2 vUv;
${COC}
void main() {
  float dist = -perspectiveDepthToViewZ(texture2D(depthBuffer, vUv).r, cameraNear, cameraFar);
  float coc = farCoc(dist);
  gl_FragColor = vec4(texture2D(inputBuffer, vUv).rgb * coc, coc);
}
`

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D blurBuffer;
uniform float focus;
uniform float range;
uniform float strength;
${COC}
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 b = texture2D(blurBuffer, uv);
  float coc = farCoc(-getViewZ(depth)) * clamp(b.a * 3.0, 0.0, 1.0);
  outputColor = vec4(mix(inputColor.rgb, b.rgb / max(b.a, 1e-4), coc), inputColor.a);
}
`

/**
 * Depth of field for the far field only: a masked half-resolution blur of everything past
 * the focus, mixed back in by distance. Three cheap passes instead of a full bokeh DOF;
 * the near field (things between camera and focus) stays sharp.
 */
export class DistanceBlurEffect extends Effect {
  readonly focus: Focus = { distance: 6, range: 90, strength: 1 }
  private readonly mask: ShaderPass
  private readonly blur = new KawaseBlurPass({
    kernelSize: KernelSize.MEDIUM,
    resolutionScale: 0.5,
  })
  private readonly masked = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
  private readonly blurred = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    // Shared by the mask pass and the final mix, so both see the same focus.
    const u = () => new THREE.Uniform(0)
    const uniforms = { focus: u(), range: u(), strength: u() }
    super('DistanceBlurEffect', FRAGMENT, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['blurBuffer', new THREE.Uniform(null)],
        ...Object.entries(uniforms),
      ]),
    })
    this.uniforms.get('blurBuffer')!.value = this.blurred.texture
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: MASK_FRAGMENT,
      uniforms: {
        inputBuffer: { value: null },
        depthBuffer: { value: null },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 1000 },
        ...uniforms,
      },
      depthWrite: false,
      depthTest: false,
    })
    this.mask = new ShaderPass(material)
  }

  override setDepthTexture(depth: THREE.Texture): void {
    ;(this.mask.fullscreenMaterial as THREE.ShaderMaterial).uniforms.depthBuffer.value = depth
  }

  override update(renderer: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget): void {
    const m = (this.mask.fullscreenMaterial as THREE.ShaderMaterial).uniforms
    m.cameraNear.value = this.camera.near
    m.cameraFar.value = this.camera.far
    m.focus.value = this.focus.distance
    m.range.value = this.focus.range
    m.strength.value = this.focus.strength
    this.mask.render(renderer, input, this.masked)
    this.blur.render(renderer, this.masked, this.blurred)
  }

  override setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width / 2))
    const h = Math.max(1, Math.round(height / 2))
    this.masked.setSize(w, h)
    this.blurred.setSize(w, h)
    this.blur.setSize(width, height)
  }

  override dispose(): void {
    super.dispose()
    this.masked.dispose()
    this.blurred.dispose()
    this.blur.dispose()
    this.mask.dispose()
  }
}
