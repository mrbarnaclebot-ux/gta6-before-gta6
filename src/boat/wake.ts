import * as THREE from 'three'
import { foamTexture } from '../sea/foam-texture'
import type { Boat } from './boat'
import { Spray, type SprayLight } from './spray'

type WaterQuery = (x: number, z: number) => number | null

/** Trail samples, one every STEP meters of travel, each living LIFE seconds. */
const SAMPLES = 90
const STEP = 0.9
const LIFE = 10
/**
 * Columns across the trail, as a share of its half width: the outer pair are the thin
 * spreading arms of the V (fading to nothing at the very edge), the middle the prop wash.
 */
const ACROSS = [-1, -0.9, -0.5, 0, 0.5, 0.9, 1]
const STERN = new THREE.Vector3(0, 0, -3.3)

interface Sample {
  x: number
  z: number
  /** Unit vector across the trail. */
  sx: number
  sz: number
  age: number
  /** 0 to 1: how hard the boat was running when it passed. */
  power: number
  /** How fast the V spreads here, m/s. */
  spread: number
  /** Distance along the trail, so the foam stays put on the water instead of crawling. */
  odo: number
}

/*
 * The foam is a red-only lace texture, sampled twice: stretched along the trail into streaks,
 * and fine for bubbles. As the strength (vertex alpha) fades the lace breaks up.
 */
const LACE = /* glsl */ `
  float streak = texture2D( alphaMap, vAlphaMapUv * vec2( 0.7, 0.09 ) ).r;
  float fine = texture2D( alphaMap, vAlphaMapUv * vec2( 2.4, 0.8 ) ).r;
  float lace = 0.6 * streak + 0.5 * fine;
  float strength = diffuseColor.a;
  diffuseColor.a = smoothstep( 1.05 - strength, 1.5 - strength, lace ) * min( 0.85, strength * 1.2 );
`

/** The driven boat's foam trail laid on the live waves, and its spray. */
export class Wake {
  readonly mesh: THREE.Mesh
  private readonly spray = new Spray()
  private readonly trail: Sample[] = []
  /** The sample that rides on the stern, so the trail starts at the boat. */
  private readonly head: Sample = { x: 0, z: 0, sx: 1, sz: 0, age: 0, power: 0, spread: 0, odo: 0 }
  private readonly geo = new THREE.BufferGeometry()
  private travelled = 0
  private odo = 0
  private readonly last = new THREE.Vector3()
  private readonly p = new THREE.Vector3()
  private readonly side = new THREE.Vector3()

  constructor(
    scene: THREE.Scene,
    private readonly water: WaterQuery,
  ) {
    const n = (SAMPLES + 1) * ACROSS.length
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4))
    this.geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    this.geo.setIndex(stripIndex(SAMPLES + 1))
    this.mesh = new THREE.Mesh(this.geo, foamMaterial())
    // World-space vertices that move every frame.
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
    scene.add(this.mesh, this.spray.points)
  }

  /** `boat`: the one being driven, or null. `light` tints the spray, which is not lit. */
  update(dt: number, boat: Boat | null, light: SprayLight, viewHeight: number): void {
    for (const s of this.trail) s.age += dt
    while (this.trail.length && this.trail[0].age > LIFE) this.trail.shift()
    if (boat) this.follow(boat)
    // Nothing on the water and nobody driving: the strip is already all clear.
    this.mesh.visible = boat !== null || this.trail.length > 0
    if (this.mesh.visible) this.draw(boat !== null)
    this.spray.update(dt, boat, light, viewHeight)
  }

  /** Drops a sample every STEP meters the stern travels, and moves the head onto the stern. */
  private follow(boat: Boat): void {
    const stern = this.p.copy(STERN).applyQuaternion(boat.quaternion).add(boat.position)
    const moved = Math.hypot(stern.x - this.last.x, stern.z - this.last.z)
    // A jump (a teleport, another boat) starts a fresh trail instead of a long smear.
    if (moved > 6) this.trail.length = 0
    this.travelled += Math.min(moved, 6)
    this.odo += Math.min(moved, 6)
    this.last.copy(stern)
    const speed = Math.abs(boat.speed)
    const side = this.side.set(1, 0, 0).applyQuaternion(boat.quaternion)
    Object.assign(this.head, {
      x: stern.x,
      z: stern.z,
      sx: side.x,
      sz: side.z,
      odo: this.odo,
      power: Math.min(1, speed / 9) * (0.4 + 0.6 * Math.abs(boat.helm.throttle)),
      spread: 0.3 * speed,
    })
    if (this.travelled < STEP || speed < 1) return
    this.travelled = 0
    this.trail.push({ ...this.head })
    if (this.trail.length > SAMPLES) this.trail.shift()
  }

  private draw(live: boolean): void {
    const pos = this.geo.attributes.position as THREE.BufferAttribute
    const col = this.geo.attributes.color as THREE.BufferAttribute
    const uv = this.geo.attributes.uv as THREE.BufferAttribute
    const n = this.trail.length
    for (let i = 0; i <= SAMPLES; i++) {
      const s = live ? (i === 0 ? this.head : this.trail[n - i]) : this.trail[n - 1 - i]
      ACROSS.forEach((a, j) => {
        const k = i * ACROSS.length + j
        if (!s) return void col.setW(k, 0)
        const half = 1.1 + s.age * s.spread
        const x = s.x + s.sx * a * half
        const z = s.z + s.sz * a * half
        const y = this.water(x, z)
        pos.setXYZ(k, x, (y ?? -100) + 0.04, z)
        uv.setXY(k, a * half, s.odo)
        col.setXYZW(k, 1, 1, 1, y === null ? 0 : foamAlpha(a, s))
      })
    }
    pos.needsUpdate = col.needsUpdate = uv.needsUpdate = true
  }
}

/** Foam strength at `across` (-1 to 1) of a sample: the V's arms, and the young prop wash. */
function foamAlpha(across: number, s: Sample): number {
  const fade = Math.max(0, 1 - s.age / LIFE) ** 1.5
  const a = Math.abs(across)
  const arm = a === 0.9 ? 0.8 : 0
  const wash = a < 0.9 ? Math.max(0, 1 - s.age / 3) * (1 - a) * 0.72 : 0
  return Math.min(1, (arm + wash) * s.power * fade)
}

/** White foam, lit like the scene, its lace streaked along the trail. */
function foamMaterial(): THREE.MeshStandardMaterial {
  const foam = foamTexture()
  // Meter UVs; the shader scales each of its two samples itself.
  foam.repeat.set(1, 1)
  const material = new THREE.MeshStandardMaterial({
    color: 0xf4f7f8,
    roughness: 0.85,
    alphaMap: foam,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    // The strip's winding flips with the trail's turns; it is only ever seen from above.
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', LACE)
  }
  return material
}

/** Two triangles per cell of the samples x ACROSS grid. */
function stripIndex(samples: number): number[] {
  const out: number[] = []
  const w = ACROSS.length
  for (let i = 0; i + 1 < samples; i++) {
    for (let j = 0; j + 1 < w; j++) {
      const a = i * w + j
      out.push(a, a + w, a + 1, a + 1, a + w, a + w + 1)
    }
  }
  return out
}
