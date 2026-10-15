import * as THREE from 'three'

/*
 * A procedural compact pistol. CREDITS.md has no free pistol model, so this is
 * built from boxes and cylinders: about 200 triangles, PBR gunmetal and polymer.
 * Local frame: barrel along +z, grip down along -y, origin at the web of the hand.
 */

function part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  return mesh
}

function pistolModel(): { root: THREE.Group; muzzle: THREE.Object3D } {
  const steel = new THREE.MeshStandardMaterial({
    color: 0x2a2c30,
    metalness: 0.85,
    roughness: 0.32,
  })
  const polymer = new THREE.MeshStandardMaterial({ color: 0x17181a, metalness: 0, roughness: 0.7 })
  const root = new THREE.Group()
  const grip = part(new THREE.BoxGeometry(0.03, 0.11, 0.045), polymer, 0, -0.045, -0.005)
  grip.rotation.x = -0.28
  const guard = part(new THREE.TorusGeometry(0.018, 0.004, 4, 10, Math.PI), polymer, 0, 0.0, 0.035)
  guard.rotation.set(Math.PI, Math.PI / 2, 0)
  root.add(
    part(new THREE.BoxGeometry(0.03, 0.032, 0.19), steel, 0, 0.032, 0.05),
    part(new THREE.BoxGeometry(0.026, 0.02, 0.15), polymer, 0, 0.008, 0.055),
    part(
      new THREE.CylinderGeometry(0.007, 0.007, 0.01, 8).rotateX(Math.PI / 2),
      steel,
      0,
      0.03,
      0.148,
    ),
    grip,
    guard,
  )
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.03, 0.16)
  root.add(muzzle)
  return { root, muzzle }
}

// Hand-bone space placement.
const HOLD_POSITION = new THREE.Vector3(0, 0.06, 0.03)
// Measured: in Pistol_Aim_Neutral the fingers (+y) point at the target and the palm faces down (-z).
const HOLD_ROTATION = new THREE.Euler(-1.75, 0, Math.PI)

/** The pistol in the right hand. `muzzle` gives the barrel tip in world space. */
export class Gun {
  readonly root: THREE.Group
  private readonly tip: THREE.Object3D

  constructor(hand: THREE.Object3D) {
    const { root, muzzle } = pistolModel()
    this.root = root
    this.tip = muzzle
    hand.updateWorldMatrix(true, false)
    // Undo any scale baked into the rig so the gun stays life-size.
    const scale = 1 / hand.getWorldScale(new THREE.Vector3()).x
    root.scale.setScalar(scale)
    root.position.copy(HOLD_POSITION).multiplyScalar(scale)
    root.rotation.copy(HOLD_ROTATION)
    hand.add(root)
  }

  set visible(on: boolean) {
    this.root.visible = on
  }

  muzzle(out: THREE.Vector3): THREE.Vector3 {
    return this.tip.getWorldPosition(out)
  }
}
