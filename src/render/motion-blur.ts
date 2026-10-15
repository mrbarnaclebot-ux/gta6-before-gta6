import * as THREE from 'three'
import { Effect, EffectAttribute } from 'postprocessing'
import { CUT_DISTANCE, FULL_BLUR, MAX_BLUR, SHARP_NEAR, shutterScale } from './motion-blur-math'

const SAMPLES = 10

// Mirrors motion-blur-math.ts: reproject this pixel into last frame, blur along the difference.
const FRAGMENT = /* glsl */ `
uniform mat4 invViewProj;
uniform mat4 prevViewProj;
uniform float strength;

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 world = invViewProj * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
  vec4 prev = prevViewProj * vec4(world.xyz / world.w, 1.0);
  vec2 v = (uv - (prev.xy / prev.w * 0.5 + 0.5)) * strength;
  float len = length(v);
  if (len > ${MAX_BLUR}) v *= ${MAX_BLUR} / len;
  float dist = -getViewZ(depth);
  v *= smoothstep(${SHARP_NEAR.toFixed(1)}, ${FULL_BLUR.toFixed(1)}, dist);
  if (dot(v, v) < 1e-8) {
    outputColor = inputColor;
    return;
  }
  // A per-pixel offset turns the steps between samples into fine noise instead of bands.
  float jitter = (rand(uv + fract(time)) - 0.5) / float(${SAMPLES - 1});
  vec4 sum = inputColor;
  float weight = 1.0;
  for (int i = 0; i < ${SAMPLES}; i++) {
    vec2 at = uv + v * (float(i) / float(${SAMPLES - 1}) - 0.5 + jitter);
    // Nearer surfaces (the player, the car) are not smeared over the background behind them.
    float k = step(dist * 0.8, -getViewZ(readDepth(at)));
    sum += texture2D(inputBuffer, at) * k;
    weight += k;
  }
  outputColor = sum / weight;
}
`

/**
 * Camera motion blur from depth reprojection. Moving objects are blurred only by the
 * camera's motion, not their own; that is the cheap kind, and it reads as speed.
 */
export class MotionBlurEffect extends Effect {
  /** 0 to 1, set each frame: low on foot, full in a fast car. */
  intensity = 1
  private readonly viewProj = new THREE.Matrix4()
  private readonly prevViewProj = new THREE.Matrix4()
  private readonly lastEye = new THREE.Vector3(Infinity, 0, 0)

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    super('MotionBlurEffect', FRAGMENT, {
      attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ['invViewProj', new THREE.Uniform(new THREE.Matrix4())],
        ['prevViewProj', new THREE.Uniform(new THREE.Matrix4())],
        ['strength', new THREE.Uniform(0)],
      ]),
    })
  }

  override update(_r: THREE.WebGLRenderer, _b: THREE.WebGLRenderTarget, dt: number): void {
    const cam = this.camera
    this.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    const u = this.uniforms
    const cut = this.lastEye.distanceTo(cam.position) > CUT_DISTANCE
    if (cut) this.prevViewProj.copy(this.viewProj)
    ;(u.get('invViewProj')!.value as THREE.Matrix4).copy(this.viewProj).invert()
    ;(u.get('prevViewProj')!.value as THREE.Matrix4).copy(this.prevViewProj)
    u.get('strength')!.value = shutterScale(dt, this.intensity)
    this.prevViewProj.copy(this.viewProj)
    this.lastEye.copy(cam.position)
  }
}
