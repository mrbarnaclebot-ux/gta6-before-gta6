import * as THREE from 'three'

export interface Spawn {
  at: THREE.Vector3
  vel: THREE.Vector3
  life: number
  /** World-space size in meters at birth and at death. */
  size: [number, number]
  alpha: number
  /** Linear color; values above 1 feed the bloom pass. */
  color: THREE.Color
  /** Upward acceleration in m/s^2: negative falls, positive rises like hot smoke. */
  lift: number
  /** Fraction of velocity lost per second. */
  drag: number
}

const vertex = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  uniform float viewHeight;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * projectionMatrix[1][1] * viewHeight * 0.5 / max(0.1, -mv.z);
    vAlpha = alpha;
    vTint = tint;
  }`

const fragment = /* glsl */ `
  uniform sampler2D map;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec4 t = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vTint * t.rgb, t.a * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

/**
 * A fixed pool of camera-facing particles in one draw call. Spawning past the
 * capacity recycles the oldest, so a long firefight never allocates.
 */
export class ParticlePool {
  readonly points: THREE.Points
  private readonly geo = new THREE.BufferGeometry()
  private readonly vel: Float32Array
  private readonly age: Float32Array
  private readonly life: Float32Array
  private readonly sizes: Float32Array
  private readonly fades: Float32Array
  private readonly physics: Float32Array
  private next = 0

  constructor(
    private readonly capacity: number,
    map: THREE.Texture,
    additive: boolean,
  ) {
    const attr = (n: number) => new THREE.BufferAttribute(new Float32Array(capacity * n), n)
    this.geo.setAttribute('position', attr(3))
    this.geo.setAttribute('tint', attr(3))
    this.geo.setAttribute('size', attr(1))
    this.geo.setAttribute('alpha', attr(1))
    this.vel = new Float32Array(capacity * 3)
    this.age = new Float32Array(capacity).fill(Infinity)
    this.life = new Float32Array(capacity).fill(1)
    this.sizes = new Float32Array(capacity * 2)
    this.fades = new Float32Array(capacity)
    this.physics = new Float32Array(capacity * 2)
    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, viewHeight: { value: 1000 } },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.points = new THREE.Points(this.geo, material)
    // Positions are world space and move every frame; a stale bounding sphere would cull them.
    this.points.frustumCulled = false
    this.points.renderOrder = additive ? 3 : 2
  }

  spawn(s: Spawn): void {
    const i = this.next
    this.next = (this.next + 1) % this.capacity
    this.geo.attributes.position.setXYZ(i, s.at.x, s.at.y, s.at.z)
    this.geo.attributes.tint.setXYZ(i, s.color.r, s.color.g, s.color.b)
    this.vel.set([s.vel.x, s.vel.y, s.vel.z], i * 3)
    this.sizes.set(s.size, i * 2)
    this.physics.set([s.lift, s.drag], i * 2)
    this.fades[i] = s.alpha
    this.age[i] = 0
    this.life[i] = s.life
  }

  update(dt: number, viewHeight: number): void {
    ;(this.points.material as THREE.ShaderMaterial).uniforms.viewHeight.value = viewHeight
    const { position, size, alpha } = this.geo.attributes
    const pos = position.array as Float32Array
    for (let i = 0; i < this.capacity; i++) {
      if (this.age[i] >= this.life[i]) {
        alpha.setX(i, 0)
        continue
      }
      this.age[i] += dt
      const t = Math.min(1, this.age[i] / this.life[i])
      const keep = Math.max(0, 1 - this.physics[i * 2 + 1] * dt)
      this.vel[i * 3 + 1] += this.physics[i * 2] * dt
      for (let k = 0; k < 3; k++) {
        this.vel[i * 3 + k] *= keep
        pos[i * 3 + k] += this.vel[i * 3 + k] * dt
      }
      size.setX(i, this.sizes[i * 2] + (this.sizes[i * 2 + 1] - this.sizes[i * 2]) * t)
      // Quick fade-in, slow fade-out.
      alpha.setX(i, this.fades[i] * Math.min(1, t * 8) * (1 - t))
    }
    position.needsUpdate = size.needsUpdate = alpha.needsUpdate = true
    this.geo.attributes.tint.needsUpdate = true
  }
}
