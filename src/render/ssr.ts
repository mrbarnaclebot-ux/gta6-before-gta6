import * as THREE from 'three'
import { Effect, EffectAttribute } from 'postprocessing'

/*
 * Screen-space reflections, High and Ultra only. Glossy materials (tower glass, car paint and
 * glass) write how mirror-like they are into the color buffer's alpha (REFLECTIVE_OUT below),
 * which opaque surfaces otherwise leave at 1. Those pixels march the reflected eye ray through
 * the depth buffer and, where it hits something on screen, show it, faded by Fresnel and at
 * the screen's edges. Where it misses, the sky reflection from the material stays.
 * It runs straight after the scene render, before anything else touches the alpha.
 */

const STEPS = 28

const FRAGMENT = /* glsl */ `
uniform mat4 ssrProj;
uniform mat4 ssrProjInv;

vec3 ssrView(vec2 uv, float d) {
  vec4 p = ssrProjInv * vec4(vec3(uv, d) * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb, 1.0);
  float mirror = 1.0 - inputColor.a;
  if (mirror < 0.02 || depth >= 1.0) return;
  vec3 p = ssrView(uv, depth);
  vec2 dx = vec2(texelSize.x, 0.0);
  vec2 dy = vec2(0.0, texelSize.y);
  vec3 n = normalize(cross(ssrView(uv + dx, readDepth(uv + dx)) - p, ssrView(uv + dy, readDepth(uv + dy)) - p));
  vec3 v = normalize(p);
  if (dot(n, v) > 0.0) n = -n;
  vec3 r = reflect(v, n);
  float len = 0.4 + 0.015 * -p.z;
  vec3 q = p + n * 0.05;
  for (int i = 0; i < ${STEPS}; i++) {
    q += r * len;
    len *= 1.13;
    vec4 c = ssrProj * vec4(q, 1.0);
    vec2 at = c.xy / c.w * 0.5 + 0.5;
    if (c.w <= 0.0 || at.x < 0.0 || at.y < 0.0 || at.x > 1.0 || at.y > 1.0) break;
    float behind = getViewZ(readDepth(at)) - q.z;
    if (behind > 0.0 && behind < len * 1.5 + 0.3) {
      vec2 edge = min(at, 1.0 - at);
      float fade = smoothstep(0.0, 0.12, min(edge.x, edge.y)) * (1.0 - float(i) / float(${STEPS}));
      float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(-v, n), 0.0), 5.0);
      vec3 seen = texture2D(inputBuffer, at).rgb;
      outputColor.rgb = mix(inputColor.rgb, seen, mirror * fade * (0.12 + 0.88 * fresnel));
      return;
    }
  }
}
`

export class SsrEffect extends Effect {
  constructor(private readonly camera: THREE.PerspectiveCamera) {
    super('SsrEffect', FRAGMENT, {
      attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ['ssrProj', new THREE.Uniform(new THREE.Matrix4())],
        ['ssrProjInv', new THREE.Uniform(new THREE.Matrix4())],
      ]),
    })
  }

  override update(): void {
    const u = this.uniforms
    ;(u.get('ssrProj')!.value as THREE.Matrix4).copy(this.camera.projectionMatrix)
    ;(u.get('ssrProjInv')!.value as THREE.Matrix4).copy(this.camera.projectionMatrixInverse)
  }
}

/**
 * The opaque output chunk with `mirror` (0 to 1, a GLSL expression) written to alpha as
 * 1 - mirror. Swap it for '#include <opaque_fragment>' in a glossy material's shader.
 * Contract: SSR reads scene alpha as the mirror mask, so every other opaque material must
 * write alpha 1 (three's default) and the canvas stays alpha: false. Transparent passes
 * (water, particles) blend alpha toward 1 over what they cover, so they never fake a mirror.
 */
export const reflectiveOut = (mirror: string) => /* glsl */ `
#ifdef OPAQUE
diffuseColor.a = 1.0 - clamp(${mirror}, 0.0, 1.0);
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );
`
