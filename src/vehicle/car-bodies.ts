import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bakeParts, type Baked } from '../world/bake-parts'
import { CAR_CODES, carGlass, carMaterial } from './car-paint'
import { bodyBounds, generatedScale, paintOf, type CarKind, type CarSpec } from './car-specs'
import { carBodyMaterial } from './generated-paint'
import { CAR_LOD } from './wheel-batch'

/*
 * The meshes a car's body is drawn with: a box stand-in until its glb loads, then either a
 * Blender body (baked, two levels of detail) or a generated one (one textured mesh).
 */

/** A loaded Blender body: baked levels of detail, nearest first, and its wheel at each level. */
export interface CarModel {
  levels: Baked[]
  wheels: THREE.BufferGeometry[]
}

let glass: THREE.Material | undefined

/** A Blender body in one paint: per level, the body and its see-through glass. */
export function bakedBody(model: CarModel, paint: number, lamps: THREE.Vector4): THREE.Object3D {
  const mat = carMaterial(paint, lamps)
  glass ??= carGlass()
  const lod = new THREE.LOD()
  model.levels.forEach((baked, i) => {
    const level = new THREE.Group()
    const body = new THREE.Mesh(baked.solid, mat)
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
  return lod
}

/** A generated body (`spec.generated`) in a variant's paint, scaled to the spec's size. */
export function generatedBody(
  source: THREE.Mesh,
  spec: CarSpec,
  variant: number,
  lamps: THREE.Vector4,
): THREE.Object3D {
  const g = spec.generated!
  const base = source.material as THREE.MeshStandardMaterial
  const paint = g.paints[paintOf(spec, variant)]
  const body = new THREE.Mesh(source.geometry, carBodyMaterial(base, paint, lamps, g.belt))
  const length = spec.front - spec.rear
  body.scale.copy(generatedScale(g, length))
  body.position.y = spec.clearance + (g.size[1] / 2) * length
  body.castShadow = body.receiveShadow = true
  return body
}

/**
 * A generated body's mesh, its node transform baked into the geometry: Meshopt quantization
 * moves part of the scale onto the node, and `generatedBody` uses the geometry alone.
 */
export function findMesh(root: THREE.Object3D): THREE.Mesh {
  let mesh: THREE.Mesh | undefined
  root.traverse((o) => (mesh ??= (o as THREE.Mesh).isMesh ? (o as THREE.Mesh) : undefined))
  if (!mesh) throw new Error('No mesh in car body')
  root.updateMatrixWorld(true)
  mesh.geometry.applyMatrix4(mesh.matrixWorld)
  return mesh
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
export function boxBody(spec: CarSpec, variant: number): THREE.Object3D {
  const color = spec.paints[paintOf(spec, variant)]
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
