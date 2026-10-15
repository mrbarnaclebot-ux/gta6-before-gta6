import * as THREE from 'three'
import type { Ambient } from './sky'

// The disc god rays stream from: about 2 degrees across, a little larger than the real sun.
const ANGULAR_RADIUS = 0.035
const MAX_DISTANCE = 1500

const FORWARD = new THREE.Vector3()
const P = new THREE.Vector3()

/** 0 below the horizon, 1 once the sun is a few degrees up. */
export function sunUp(y: number): number {
  return THREE.MathUtils.smoothstep(y, -0.02, 0.1)
}

/**
 * Where the sun is on screen and how bright its glare is, for god rays and the lens flare.
 * The disc is not in the scene: GodRaysEffect draws it on its own, masked by scene depth,
 * so anything in front of the sun blocks its rays.
 */
export class SunFx {
  readonly disc = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false }),
  )
  /** The sun in screen uv (0 to 1, y up). */
  readonly uv = new THREE.Vector2()
  /** Lens flare strength: 0 when the sun is set, behind the camera, or off screen. */
  flare = 0
  readonly tint = new THREE.Color()

  update(camera: THREE.PerspectiveCamera, a: Ambient, underwater: boolean): void {
    const glare = underwater ? 0 : a.day * sunUp(a.sunDir.y)
    const d = Math.min(camera.far * 0.9, MAX_DISTANCE)
    this.disc.position.copy(camera.position).addScaledVector(a.sunDir, d)
    this.disc.scale.setScalar(d * ANGULAR_RADIUS)
    this.disc.updateMatrixWorld()
    this.tint.copy(a.sunColor)
    ;(this.disc.material as THREE.MeshBasicMaterial).color.copy(a.sunColor).multiplyScalar(glare)
    camera.getWorldDirection(FORWARD)
    P.copy(this.disc.position).project(camera)
    this.uv.set(P.x * 0.5 + 0.5, P.y * 0.5 + 0.5)
    const facing = FORWARD.dot(a.sunDir) > 0
    // Fade out as the sun nears the screen edge instead of popping off.
    const edge = Math.min(1, (1.1 - Math.max(Math.abs(P.x), Math.abs(P.y))) / 0.3)
    this.flare = facing ? glare * Math.max(0, edge) : 0
  }
}
