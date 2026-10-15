import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { carBodyMaterial } from './car-paint'
import { bodyBounds, bodyScale, CAR_SPECS, type CarKind, type CarSpec } from './car-specs'
import { WheelBatch } from './wheel-batch'

export { PAINT_COUNT } from './car-specs'
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

export type CarFactory = (variant: number, kind?: CarKind) => CarVisual

type Made = { visual: CarVisual; kind: CarKind; variant: number; body: THREE.Object3D }

/**
 * Hands out cars right away with a plain box body, then swaps in the generated bodies
 * once they load (after the first frame), so a slow or missing glb never blocks play.
 * Every car already has its real wheels and physics size from `CAR_SPECS`.
 */
export class CarModels {
  private readonly made: Made[] = []
  private readonly wheels = new Map<CarKind, WheelBatch>()

  private stale = true

  constructor(private readonly scene: THREE.Scene) {
    // This class owns the scene-wide hook; another assignment would freeze every wheel.
    // The frame's first scene render (main pass) syncs; the mirror and AO reuse it.
    scene.onBeforeRender = () => {
      if (!this.stale) return
      this.stale = false
      this.wheels.forEach((b) => b.sync())
    }
  }

  /** Call once a frame before rendering so the next scene render picks up the wheels. */
  newFrame(): void {
    this.stale = true
  }

  readonly make: CarFactory = (variant, kind = 'sports') => {
    const spec = CAR_SPECS[kind]
    const lamps = new THREE.Vector4(0, 0, 0, spec.roofLamps)
    const root = new THREE.Group()
    const body = boxBody(spec, kind, variant)
    root.add(body)
    const wheels = this.addWheels(root, kind)
    const visual = {
      root,
      wheels,
      lamps,
      bounds: bodyBounds(spec),
      seat: spec.seat,
      police: kind === 'police',
      kind,
    }
    this.made.push({ visual, kind, variant, body })
    return visual
  }

  /** Loads both bodies and swaps them into every car made so far. */
  async upgrade(load: (url: string) => Promise<GLTF>): Promise<void> {
    await Promise.all(
      (Object.keys(CAR_SPECS) as CarKind[]).map(async (kind) => {
        try {
          this.swap(kind, findMesh((await load(CAR_SPECS[kind].url)).scene))
        } catch (err) {
          console.warn(`The ${kind} car body failed to load; keeping the box body`, err)
        }
      }),
    )
  }

  private swap(kind: CarKind, source: THREE.Mesh): void {
    const spec = CAR_SPECS[kind]
    const base = source.material as THREE.MeshStandardMaterial
    for (const m of this.made) {
      if (m.kind !== kind) continue
      const paint = spec.paints[m.variant % spec.paints.length]
      const body = new THREE.Mesh(source.geometry, carBodyMaterial(base, paint, m.visual.lamps))
      body.scale.copy(bodyScale(spec))
      body.position.y = spec.clearance + (spec.size[1] / 2) * spec.length
      body.castShadow = body.receiveShadow = true
      m.visual.root.remove(m.body)
      m.visual.root.add(body)
      m.body = body
    }
  }

  private addWheels(root: THREE.Object3D, kind: CarKind): THREE.Object3D[] {
    const { wheel: w } = CAR_SPECS[kind]
    let batch = this.wheels.get(kind)
    if (!batch) {
      batch = new WheelBatch(w.radius, w.width)
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

function findMesh(root: THREE.Object3D): THREE.Mesh {
  let mesh: THREE.Mesh | undefined
  root.traverse((o) => (mesh ??= (o as THREE.Mesh).isMesh ? (o as THREE.Mesh) : undefined))
  if (!mesh) throw new Error('No mesh in car body')
  return mesh
}

const boxPaints = new Map<number, THREE.Material>()
const dark = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.25, metalness: 0.4 })
// One unit cube scaled per box, so swapping in the real body leaves no geometry to dispose.
const cube = new THREE.BoxGeometry()

/** Stand-in body until the glb arrives: a lower box and a glassy cabin, in the car's size. */
function boxBody(spec: CarSpec, kind: CarKind, variant: number): THREE.Object3D {
  const color =
    kind === 'police'
      ? 0x111111
      : [0xe0623a, 0xa90a12, 0x0f9fa3, 0xd9346e, 0xeeebe4, 0x0b0c0e][variant % 6]
  if (!boxPaints.has(color))
    boxPaints.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 }))
  const b = bodyBounds(spec)
  const size = b.getSize(new THREE.Vector3())
  const group = new THREE.Group()
  const box = (w: number, h: number, d: number, y: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(cube, mat)
    mesh.scale.set(w, h, d)
    mesh.position.y = y
    mesh.castShadow = true
    group.add(mesh)
  }
  box(size.x * 0.95, size.y * 0.5, size.z, b.min.y + size.y * 0.25, boxPaints.get(color)!)
  box(size.x * 0.8, size.y * 0.45, size.z * 0.45, b.min.y + size.y * 0.72, dark)
  return group
}
