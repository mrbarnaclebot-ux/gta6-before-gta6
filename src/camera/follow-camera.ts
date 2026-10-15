import * as THREE from 'three'
import { RAPIER, type PhysicsWorld } from '../physics'
import { clampPitch, nextDistance, orbitDirection } from './orbit-math'

const SENSITIVITY = 0.0025
const PIVOT_HEIGHT = 1.55
const DISTANCE = 4.6
const MIN_DISTANCE = 0.8
const PROBE_RADIUS = 0.25

/** Third-person orbit camera that sweeps a sphere toward its ideal spot so walls never clip the view. */
export class FollowCamera {
  yaw = 0
  pitch = 0.18
  private distance = DISTANCE
  private readonly pivot = new THREE.Vector3()
  private readonly dir = new THREE.Vector3()
  private readonly probe = new RAPIER.Ball(PROBE_RADIUS)

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly physics: PhysicsWorld,
    private readonly ignore: InstanceType<typeof RAPIER.Collider>,
  ) {}

  update(dt: number, look: { x: number; y: number }, focus: THREE.Vector3): void {
    this.yaw -= look.x * SENSITIVITY
    this.pitch = clampPitch(this.pitch + look.y * SENSITIVITY)
    this.pivot.set(focus.x, focus.y + PIVOT_HEIGHT, focus.z)
    this.dir.fromArray(orbitDirection(this.yaw, this.pitch))
    this.distance = nextDistance(this.distance, this.clearance(), dt)
    this.camera.position.copy(this.pivot).addScaledVector(this.dir, this.distance)
    this.camera.lookAt(this.pivot)
  }

  private clearance(): number {
    const hit = this.physics.castShape(
      this.pivot,
      { x: 0, y: 0, z: 0, w: 1 },
      this.dir,
      this.probe,
      0,
      DISTANCE,
      true,
      undefined,
      undefined,
      this.ignore,
    )
    return hit ? Math.max(MIN_DISTANCE, hit.time_of_impact) : DISTANCE
  }
}
