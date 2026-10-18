import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bakeParts, type Baked } from '../world/bake-parts'
import { CAR_CODES, carGlass, carMaterial } from './car-paint'
import { bodyBounds, CAR_SPECS, paintOf, type CarKind, type CarSpec } from './car-specs'
import { CAR_LOD, WheelBatch } from './wheel-batch'
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

/** A loaded body: baked levels of detail, nearest first, and its wheel at each level. */
interface CarModel {
  levels: Baked[]
  wheels: THREE.BufferGeometry[]
}

const NO_LAMPS = new THREE.Vector4()
let wheelMaterial: THREE.Material | undefined
let glass: THREE.Material | undefined

/**
 * Hands out cars right away with a plain box body, then swaps in the Blender bodies once
 * they load (after the first frame), so a slow or missing glb never blocks play. Every car
 * already has its real wheels and physics size from `CAR_SPECS`.
 */
export class CarModels {
  private readonly made: Made[] = []
  private readonly wheels = new Map<CarKind, WheelBatch>()
  /** Bodies loaded so far: cars made after that (traffic replacing a stolen car) get them at once. */
  private readonly loaded = new Map<CarKind, CarModel>()
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
      lamps: new THREE.Vector4(),
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
          this.swap(kind, carModel((await load(CAR_SPECS[kind].url)).scene, kind))
        } catch (err) {
          console.warn(`The ${kind} car body failed to load; keeping the box body`, err)
        }
      }),
    )
  }

  private swap(kind: CarKind, model: CarModel): void {
    this.loaded.set(kind, model)
    wheelMaterial ??= carMaterial(0, NO_LAMPS)
    const batch = this.wheels.get(kind)
    if (batch) {
      const levels = model.wheels.map((geometry) => [{ geometry, material: wheelMaterial! }])
      this.scene.remove(...batch.setLevels(levels))
      this.scene.add(...batch.meshes)
    }
    for (const m of this.made) if (m.kind === kind) this.dress(m, model)
  }

  private dress(m: Made, model: CarModel): void {
    const paint = carMaterial(paintOf(CAR_SPECS[m.kind], m.variant), m.visual.lamps)
    glass ??= carGlass()
    const lod = new THREE.LOD()
    model.levels.forEach((baked, i) => {
      const level = new THREE.Group()
      const body = new THREE.Mesh(baked.solid, paint)
      body.castShadow = body.receiveShadow = true
      level.add(body)
      if (baked.clear) {
        // Sun through the windows: the glass casts no shadow, which also saves its shadow passes.
        const pane = new THREE.Mesh(baked.clear, glass)
        pane.userData.noShadow = true
        level.add(pane)
      }
      lod.addLevel(level, i * CAR_LOD)
    })
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

/**
 * A car glb baked for drawing: per level, the body (everything but the wheels) in car space,
 * and the front-left wheel about its hub. Node transforms are baked in, which matters:
 * Meshopt quantization moves part of each mesh's scale onto its node.
 */
export function carModel(scene: THREE.Object3D, kind: CarKind): CarModel {
  scene.updateMatrixWorld(true)
  const level = (name: string) => {
    const root = scene.getObjectByName(name)
    if (!root) throw new Error(`No ${name} in the car glb`)
    const toCar = root.matrixWorld.clone().invert()
    const wheel = root.children.find((c) => c.name.startsWith('wheel_fl'))!
    const hub = new THREE.Matrix4().makeTranslation(wheel.position.clone().negate())
    const body = root.children.filter((c) => !c.name.startsWith('wheel'))
    return {
      body: bakeParts(body, toCar, (name) => CAR_CODES[name] ?? 0),
      wheel: bakeParts([wheel], hub.multiply(toCar)),
    }
  }
  const near = level(kind)
  const far = level(`${kind}_lod1`)
  // Far off, the dark glass reads the same drawn opaque: one draw call per distant car.
  const solid = mergeGeometries([far.body.solid, ...(far.body.clear ? [far.body.clear] : [])])!
  return {
    levels: [near.body, { solid, clear: null }],
    wheels: [near.wheel.solid, far.wheel.solid],
  }
}

const boxPaints = new Map<number, THREE.Material>()
const dark = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.25, metalness: 0.4 })
// One unit cube scaled per box, so swapping in the real body leaves no geometry to dispose.
const cube = new THREE.BoxGeometry()

/** Stand-in body until the glb arrives: a lower box and a glassy cabin, in the car's size. */
function boxBody(spec: CarSpec, variant: number): THREE.Object3D {
  const color = paintOf(spec, variant)
  if (!boxPaints.has(color))
    boxPaints.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 }))
  const b = bodyBounds(spec)
  const size = b.getSize(new THREE.Vector3())
  const center = b.getCenter(new THREE.Vector3())
  const group = new THREE.Group()
  const box = (w: number, h: number, d: number, y: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(cube, mat)
    mesh.scale.set(w, h, d)
    mesh.position.set(0, y, center.z)
    mesh.castShadow = true
    group.add(mesh)
  }
  box(size.x * 0.95, size.y * 0.5, size.z, b.min.y + size.y * 0.25, boxPaints.get(color)!)
  box(size.x * 0.8, size.y * 0.45, size.z * 0.45, b.min.y + size.y * 0.72, dark)
  return group
}
