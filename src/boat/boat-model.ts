import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { underwaterLightAll } from '../sea/caustics'

const URL = '/assets/models/vehicle/boat.glb'
/** The generated hull comes 1 unit long with its bow at +z; this is its real length in meters. */
const LENGTH = 7.2
/**
 * Lifts the model so its waterline sits on boat-space y = 0: the keel is 0.134 units below
 * the model's center, and the hull draws about 0.45 m.
 */
const MODEL_Y = 0.134 * LENGTH - 0.45

/** One boat's visuals. Boat space: +z bow, +x port (left), y up, waterline at 0. */
export interface BoatVisual {
  root: THREE.Object3D
  /** The hull box in boat space, without the outboard. */
  bounds: THREE.Box3
  /** The driver's feet at the helm, starboard side behind the windshield. */
  seat: THREE.Vector3
}

export const HULL_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-1.25, -0.45, -3.35),
  new THREE.Vector3(1.25, 0.85, 3.45),
)

/** The windshield and console above the hull box, measured off the model. */
export const COCKPIT_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-1.1, 0.85, -2),
  new THREE.Vector3(1.1, 1.5, 1.2),
)

/**
 * Hands out boats at once with a plain stand-in hull, then swaps in the generated model
 * once it loads, so a slow or missing glb never blocks play (the same pattern as cars).
 */
export class BoatModels {
  private readonly made: { root: THREE.Object3D; stand: THREE.Object3D }[] = []
  private model: THREE.Object3D | null = null

  make = (): BoatVisual => {
    const root = new THREE.Group()
    const stand = this.model ? this.model.clone() : standIn()
    root.add(stand)
    this.made.push({ root, stand })
    return { root, bounds: HULL_BOUNDS, seat: new THREE.Vector3(-0.42, 0.05, -0.55) }
  }

  async load(load: (url: string) => Promise<GLTF>): Promise<void> {
    try {
      this.model = normalize((await load(URL)).scene)
    } catch (err) {
      return console.warn('The boat model failed to load; keeping the stand-in hull', err)
    }
    for (const m of this.made) {
      m.root.remove(m.stand)
      m.stand = this.model.clone()
      m.root.add(m.stand)
      // New meshes: let the shadow toggle (render/actor-shadows.ts) walk this root again.
      delete m.root.userData.castShadow
    }
  }
}

/** Scales the 1-unit model to meters, sets its waterline, and readies its material. */
function normalize(scene: THREE.Object3D): THREE.Object3D {
  const holder = new THREE.Group()
  scene.scale.setScalar(LENGTH)
  scene.position.y = MODEL_Y
  holder.add(scene)
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = mesh.receiveShadow = true
    const m = mesh.material as THREE.MeshStandardMaterial
    // Gelcoat is glossy; the generated roughness map reads chalky under the sky light.
    m.roughness = 0.75
    m.envMapIntensity = 1.2
  })
  underwaterLightAll(holder)
  return holder
}

const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.3 })

/** A white wedge of the hull's size until the model arrives. */
function standIn(): THREE.Object3D {
  const size = HULL_BOUNDS.getSize(new THREE.Vector3())
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), white)
  HULL_BOUNDS.getCenter(mesh.position)
  mesh.castShadow = true
  return mesh
}
