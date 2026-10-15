import * as THREE from 'three'
import type { World } from './game'
import { RAPIER } from './physics'
import { DynamicRes } from './render/dynamic-res'
import type { Graphics, Tier } from './render/graphics'
import { REACH } from './render/view-distance'

// Sea mirror size per Water reflections setting, in pixels.
const MIRROR: Record<Tier, number> = { low: 256, medium: 512, high: 768, ultra: 1024 }
// Focus point on foot: the player's chest. While aiming: whatever the crosshair is on.
const CHEST = 1.2
const AIM_RANGE = 300
const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] as const

/**
 * Raises every texture that asked for anisotropic filtering (roads, sand, facades, palms)
 * to the GPU's maximum: sharper at grazing angles for a cost too small to measure.
 */
function sharpenTextures(scene: THREE.Scene, max: number): void {
  scene.traverse((o) => {
    const mat = (o as THREE.Mesh).material as unknown as Record<string, THREE.Texture | null>
    for (const key of mat ? MAPS : []) {
      const t = mat[key]
      if (t && t.anisotropy > 1 && t.anisotropy < max) t.anisotropy = max
    }
  })
}

/** How the city looks: applies graphics settings and feeds the camera effects each frame. */
export class Look {
  graphics: Graphics
  private readonly dynamic: DynamicRes
  private readonly focus = new THREE.Vector3()
  private readonly chest = new THREE.Vector3()
  private readonly dir = new THREE.Vector3()
  private readonly eye = new THREE.Vector3()
  private readonly ray = new RAPIER.Ray(this.eye, this.dir)
  // Rebuilding the shadow maps and relinking every lit material is a hitch; skip it when unchanged.
  private shadowSetup = ''

  constructor(
    private readonly w: World,
    g: Graphics,
  ) {
    this.graphics = g
    this.dynamic = new DynamicRes(g.renderScale)
    sharpenTextures(w.scene, w.renderer.gl.capabilities.getMaxAnisotropy())
    this.apply(g)
  }

  apply(g: Graphics): void {
    const { w } = this
    const reach = REACH[g.distance]
    this.graphics = g
    w.camera.far = reach.far
    w.renderer.apply(g)
    w.sky.setOutput(w.renderer.post, reach.fog)
    const shadows = `${g.shadows}:${reach.shadows}`
    if (shadows !== this.shadowSetup) w.shadows.configure(g.shadows, reach.shadows)
    this.shadowSetup = shadows
    w.city.setDetail(reach.plants, MIRROR[g.reflections])
    w.driving.drawRange = reach.cars
    this.dynamic.reset(g.renderScale)
  }

  /** Shadows, sun glare, focus, and motion blur for this frame; dynamic resolution. */
  update(dt: number): void {
    const { w } = this
    const { ambient } = w.sky
    w.shadows.update(w.driving.position, ambient.sunDir)
    w.renderer.sun.update(w.camera, ambient, w.city.underwater)
    const aim = w.follow.aim
    w.renderer.frame({
      focus: this.focusPoint(aim),
      aim,
      speed: Math.abs(w.driving.car?.speed ?? 0),
    })
    if (this.graphics.dynamicRes) w.renderer.setScale(this.dynamic.update(dt))
  }

  private focusPoint(aim: number): THREE.Vector3 {
    const { w, focus, chest } = this
    chest.copy(w.driving.position).setY(chest.y + CHEST)
    if (aim < 0.05) return focus.copy(chest)
    w.camera.getWorldDirection(this.dir)
    const eye = this.eye.copy(w.camera.position)
    const hit = w.physics.castRay(
      this.ray,
      AIM_RANGE,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      w.player.collider,
    )
    const far = focus.copy(eye).addScaledVector(this.dir, hit ? hit.timeOfImpact : AIM_RANGE)
    // Ease from the player to the target as the camera settles into the aim.
    return far.lerp(chest, 1 - aim)
  }
}
