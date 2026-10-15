import * as THREE from 'three'

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  // Rotation only, and depth pinned to the far plane: the sky is infinitely far away.
  gl_Position = (projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0)).xyww;
}
`

/*
 * Day and night HDRIs blended by the time of day. The day sky turns about the
 * vertical so its clouds and glare track the moving sun, its painted sun is
 * clamped away, and a sharp disk is drawn where the light really is. Below the
 * horizon it is exactly the fog color, so fogged sea meets it without a seam.
 */
const FRAGMENT = /* glsl */ `
#include <common>
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform vec3 dayTint;
uniform vec3 nightTint;
uniform float yaw;
uniform vec3 horizon;
uniform vec3 sunDir;
uniform vec3 sunDisk;
uniform vec3 glow;
varying vec3 vDir;

vec3 turned(vec3 d) {
  float c = cos(yaw), s = sin(yaw);
  return vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
}

void main() {
  vec3 d = normalize(vDir);
  vec3 day = texture2D(dayMap, equirectUv(turned(d))).rgb;
  day *= min(1.0, 6.0 / max(luminance(day), 1e-4));
  vec3 sky = day * dayTint + texture2D(nightMap, equirectUv(d)).rgb * nightTint;
  float toSun = max(dot(d, sunDir), 0.0);
  float low = pow(1.0 - max(d.y, 0.0), 5.0);
  sky += glow * (pow(toSun, 12.0) * 1.5 + low * (0.25 + 0.75 * pow(toSun, 2.0)));
  sky += sunDisk * smoothstep(0.99990, 0.99996, toSun);
  gl_FragColor = vec4(mix(horizon, sky, smoothstep(0.0, 0.06, d.y)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export type DomeUniforms = {
  dayMap: { value: THREE.Texture | null }
  nightMap: { value: THREE.Texture | null }
  dayTint: { value: THREE.Color }
  nightTint: { value: THREE.Color }
  yaw: { value: number }
  horizon: { value: THREE.Color }
  sunDir: { value: THREE.Vector3 }
  sunDisk: { value: THREE.Color }
  glow: { value: THREE.Color }
}

/** The sky: drawn first behind everything, also by the water's mirror camera. */
export function skyDome(): { mesh: THREE.Mesh; uniforms: DomeUniforms } {
  const uniforms: DomeUniforms = {
    dayMap: { value: null },
    nightMap: { value: null },
    dayTint: { value: new THREE.Color(1, 1, 1) },
    nightTint: { value: new THREE.Color(0, 0, 0) },
    yaw: { value: 0 },
    horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunDisk: { value: new THREE.Color() },
    glow: { value: new THREE.Color() },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1000
  mesh.visible = false
  return { mesh, uniforms }
}
