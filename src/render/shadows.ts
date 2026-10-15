import * as THREE from 'three'
import { CSM } from 'three/examples/jsm/csm/CSM.js'
import { CsmMaterials } from './csm-materials'
import { installCsmChunks } from './csm-shader'
import type { Tier } from './graphics'

// Far enough up the sun ray that 200 m towers sit inside the shadow camera's depth range.
const SUN_DISTANCE = 400
const SINGLE = { size: 1024, extent: 50 }
const CASCADES: Record<Exclude<Tier, 'low'>, { count: number; size: number }> = {
  medium: { count: 3, size: 1024 },
  high: { count: 3, size: 2048 },
  ultra: { count: 4, size: 2048 },
}
// Filter radius in texels per cascade: crisp next to the player, softer farther out,
// where each texel already covers more ground.
const RADII = [1.5, 2.5, 3, 3]
// New materials (a car body swapped in, a decal) are set up within this many frames.
const ADOPT_EVERY = 10

/**
 * The sun's shadows: one map that follows the player on Low, cascaded shadow maps
 * (three's CSM) from Medium up, reaching `distance` meters from the camera.
 */
export class Shadows {
  private csm: CSM | null = null
  private materials: CsmMaterials | null = null
  private frame = 0
  private lens = ''

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly sun: THREE.DirectionalLight,
  ) {
    const cam = sun.shadow.camera
    cam.near = 1
    cam.far = SUN_DISTANCE * 2
    // Depth bias scales with the 800 m depth range: -0.0001 is about 8 cm.
    sun.shadow.bias = -0.0001
    sun.shadow.normalBias = 0.03
    sun.shadow.radius = 2
  }

  configure(tier: Tier, distance: number): void {
    this.dispose()
    const single = tier === 'low'
    this.sun.visible = this.sun.castShadow = single
    if (single) return this.single()
    const { count, size } = CASCADES[tier]
    const csm = new CSM({
      camera: this.camera,
      parent: this.scene,
      cascades: count,
      maxFar: distance,
      shadowMapSize: size,
      shadowBias: -0.00004,
      lightNear: 1,
      lightFar: 1400,
      lightMargin: 250,
      mode: 'practical',
    })
    installCsmChunks()
    csm.fade = true
    csm.lights.forEach((l, i) => {
      l.shadow.radius = RADII[i]
      l.shadow.needsUpdate = true
    })
    this.csm = csm
    this.materials = new CsmMaterials(csm)
    this.materials.adopt(this.scene)
    csm.updateFrustums()
  }

  /** Per frame: follow the camera (CSM) or the player (single map), with the sun's light. */
  update(focus: THREE.Vector3, sunDir: THREE.Vector3): void {
    const csm = this.csm
    if (!csm) return this.follow(focus, sunDir)
    if (++this.frame % ADOPT_EVERY === 0) this.materials!.adopt(this.scene)
    const lens = `${this.camera.fov.toFixed(1)},${this.camera.aspect.toFixed(3)},${this.camera.far}`
    if (lens !== this.lens) {
      this.lens = lens
      csm.updateFrustums()
    }
    csm.lightDirection.copy(sunDir).negate()
    for (const l of csm.lights) {
      l.color.copy(this.sun.color)
      l.intensity = this.sun.intensity
    }
    csm.update()
    // The nearest cascade redraws every frame; the farther ones take turns, one per frame.
    // A skipped map keeps last frame's matrix with it, so it stays aligned, just a frame old.
    const turn = 1 + (this.frame % (csm.lights.length - 1))
    csm.lights.forEach((l, i) => {
      l.shadow.autoUpdate = false
      l.shadow.needsUpdate ||= i === 0 || i === turn
      // Normal bias of about one texel, which grows with each cascade's footprint.
      const cam = l.shadow.camera
      l.shadow.normalBias = ((cam.right - cam.left) / l.shadow.mapSize.x) * 1.2
    })
  }

  private single(): void {
    const cam = this.sun.shadow.camera
    cam.left = cam.bottom = -SINGLE.extent
    cam.right = cam.top = SINGLE.extent
    cam.updateProjectionMatrix()
    this.sun.shadow.mapSize.set(SINGLE.size, SINGLE.size)
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null
  }

  /** Keep the single shadow frustum centered on the player so shadows stay sharp near them. */
  private follow(focus: THREE.Vector3, sunDir: THREE.Vector3): void {
    // Snap to shadow texels so shadow edges do not shimmer while walking.
    const texel = (SINGLE.extent * 2) / SINGLE.size
    const x = Math.round(focus.x / texel) * texel
    const z = Math.round(focus.z / texel) * texel
    this.sun.target.position.set(x, 0, z)
    this.sun.position.set(x, 0, z).addScaledVector(sunDir, SUN_DISTANCE)
  }

  private dispose(): void {
    if (!this.csm) return
    this.materials!.release()
    this.csm.remove()
    for (const l of this.csm.lights) l.shadow.dispose()
    this.csm = this.materials = null
    this.lens = ''
  }
}
