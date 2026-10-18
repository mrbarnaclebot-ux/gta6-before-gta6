import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { bakedBody, boxBody, carModel, findMesh, generatedBody, type CarModel } from './car-bodies'
import { carMaterial } from './car-paint'
import { bodyBounds, CAR_SPECS, paintOf, type CarKind } from './car-specs'
import { WheelBatch } from './wheel-batch'
import { wheelParts } from './wheel-model'

export type { CarKind } from './car-specs'

/** One car's visuals. Wheels are pivots at the hubs: x spins, y steers. */
export interface CarVisual {
  root: THREE.Object3D
  /** Front left, front right, rear left, rear right. */
  wheels: THREE.Object3D[]
  /** Read by the body shader every frame: x headlights, y brake lights, z light bar (+red, -blue). */
  lamps: THREE.Vector4
  /** Chassis bounds in car space (+z forward, y up, ground at 0), without the wheels. */
  bounds: THREE.Box3
  /** Driver's feet in car space. */
  seat: THREE.Vector3
  police: boolean
  kind: CarKind
}

export type CarFactory = (variant: number, kind: CarKind) => CarVisual

type Made = { visual: CarVisual; kind: CarKind; variant: number; body: THREE.Object3D }

/** A loaded body: a baked Blender one, or a generated body's mesh. */
type Loaded = CarModel | THREE.Mesh

const NO_LAMPS = new THREE.Vector4()
let wheelMaterial: THREE.Material | undefined

/**
 * Hands out cars right away with a plain box body, then swaps in the real bodies once they
 * load (after the first frame), so a slow or missing glb never blocks play. Every car already
 * has its real wheels and physics size from `CAR_SPECS`.
 */
export class CarModels {
  private readonly made: Made[] = []
  private readonly wheels = new Map<CarKind, WheelBatch>()
  /** Bodies loaded so far: cars made after that (traffic replacing a stolen car) get them at once. */
  private readonly loaded = new Map<CarKind, Loaded>()
  private readonly eye = new THREE.Vector3()

  private stale = true

  constructor(private readonly scene: THREE.Scene) {
    // This class owns the scene-wide hook; another assignment would freeze every wheel.
    // The frame's first scene render (main pass) syncs; the mirror and AO reuse it.
    scene.onBeforeRender = (_renderer, _scene, camera) => {
      if (!this.stale) return
      this.stale = false
      this.eye.setFromMatrixPosition(camera.matrixWorld)
      this.wheels.forEach((b) => b.sync(this.eye))
    }
  }

  /** Call once a frame before rendering so the next scene render picks up the wheels. */
  newFrame(): void {
    this.stale = true
  }

  readonly make: CarFactory = (variant, kind) => {
    const spec = CAR_SPECS[kind]
    const root = new THREE.Group()
    const body = boxBody(spec, variant)
    root.add(body)
    const visual = {
      root,
      wheels: this.addWheels(root, kind),
      // w: the generated police body's light bar height (generated-paint.ts).
      lamps: new THREE.Vector4(0, 0, 0, spec.generated?.roofLamps ?? 0),
      bounds: bodyBounds(spec),
      seat: spec.seat,
      police: kind === 'police',
      kind,
    }
    const made = { visual, kind, variant, body }
    this.made.push(made)
    const model = this.loaded.get(kind)
    if (model) this.dress(made, model)
    return visual
  }

  /** Loads every body and swaps it into every car made so far. */
  async upgrade(load: (url: string) => Promise<GLTF>): Promise<void> {
    await Promise.all(
      (Object.keys(CAR_SPECS) as CarKind[]).map(async (kind) => {
        try {
          const { scene } = await load(CAR_SPECS[kind].url)
          this.swap(kind, CAR_SPECS[kind].generated ? findMesh(scene) : carModel(scene, kind))
        } catch (err) {
          console.warn(`The ${kind} car body failed to load; keeping the box body`, err)
        }
      }),
    )
  }

  private swap(kind: CarKind, model: Loaded): void {
    this.loaded.set(kind, model)
    wheelMaterial ??= carMaterial(0, NO_LAMPS)
    const batch = this.wheels.get(kind)
    // A generated body keeps the procedural wheels it was made with.
    if (batch && !(model instanceof THREE.Mesh)) {
      const levels = model.wheels.map((geometry) => [{ geometry, material: wheelMaterial! }])
      this.scene.remove(...batch.setLevels(levels))
      this.scene.add(...batch.meshes)
    }
    for (const m of this.made) if (m.kind === kind) this.dress(m, model)
  }

  private dress(m: Made, model: Loaded): void {
    const spec = CAR_SPECS[m.kind]
    const { lamps } = m.visual
    const lod =
      model instanceof THREE.Mesh
        ? generatedBody(model, spec, m.variant, lamps)
        : bakedBody(model, spec.paints[paintOf(spec, m.variant)], lamps)
    m.visual.root.remove(m.body)
    m.visual.root.add(lod)
    m.body = lod
    delete m.visual.root.userData.castShadow
  }

  private addWheels(root: THREE.Object3D, kind: CarKind): THREE.Object3D[] {
    const { wheel: w } = CAR_SPECS[kind]
    let batch = this.wheels.get(kind)
    if (!batch) {
      batch = new WheelBatch([wheelParts(w.radius, w.width)])
      this.wheels.set(kind, batch)
      this.scene.add(...batch.meshes)
    }
    return [w.front, w.front, w.rear, w.rear].map((z, i) => {
      const left = i % 2 === 0
      const pivot = new THREE.Object3D()
      pivot.rotation.order = 'YXZ'
      pivot.position.set(left ? w.x : -w.x, w.radius, z)
      root.add(pivot)
      // The model's rim faces +x, which is the car's left; turn it round for the right side.
      batch.add(pivot, root, !left)
      return pivot
    })
  }
}
