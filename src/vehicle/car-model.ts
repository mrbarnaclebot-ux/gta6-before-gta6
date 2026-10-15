import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const URL = '/assets/models/vehicle/car_concept.glb'
const WHEELS = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'] as const
const BODY_PAINT = 'Paint 1 Carmine'

/** Miami street palette: pearl white, turquoise, hot pink, black, the model's own carmine, sunset orange. */
const PAINTS = [0xeeebe4, 0x0f9fa3, 0xd9346e, 0x0b0c0e, 0xa90a12, 0xe0623a]
export const PAINT_COUNT = PAINTS.length

/** One drivable car's visuals. Wheels are pivots at the hubs: x spins, y steers. */
export interface CarVisual {
  root: THREE.Object3D
  wheels: THREE.Object3D[]
  headlights: THREE.MeshStandardMaterial
  brakelights: THREE.MeshStandardMaterial
  /** Chassis bounds in car space (+z forward, y up, ground at 0), without the wheels. */
  bounds: THREE.Box3
}

export type CarFactory = (variant: number) => CarVisual

/** Loads the car once and returns a factory that clones it cheaply, sharing geometry. */
export async function loadCarModel(load: (url: string) => Promise<GLTF>): Promise<CarFactory> {
  try {
    const template = prepare((await load(URL)).scene)
    const paints = PAINTS.map((c) => paintFor(template, c))
    const bounds = chassisBounds(template, wheelsOf(template))
    return (variant) => instance(template, paints[variant % paints.length], bounds)
  } catch (err) {
    console.warn('Car model failed to load, using a box car', err)
    return (variant) => boxCar(PAINTS[variant % PAINTS.length])
  }
}

/** Wraps the Z-up model, gives each wheel a hub pivot, merges the body, and swaps costly glass. */
function prepare(scene: THREE.Object3D): THREE.Object3D {
  const root = new THREE.Group().add(scene)
  root.updateMatrixWorld(true)
  for (const name of WHEELS) {
    const wheel = scene.getObjectByName(name)!
    const pivot = new THREE.Group()
    pivot.name = `${name}Pivot`
    pivot.rotation.order = 'YXZ'
    wheel.getWorldPosition(pivot.position)
    root.add(pivot)
    pivot.attach(wheel)
  }
  root.remove(scene)
  root.add(mergeByMaterial(scene))
  const glass = tintedGlass()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    if ((mesh.material as THREE.Material).name === 'Glass') mesh.material = glass
  })
  return root
}

/**
 * The body is about 90 meshes; one per material is about 25, which matters with a
 * dozen cars on screen each drawn again for shadows and ambient occlusion.
 */
function mergeByMaterial(scene: THREE.Object3D): THREE.Object3D {
  const groups = new Map<string, { material: THREE.Material; parts: THREE.BufferGeometry[] }>()
  scene.updateMatrixWorld(true)
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
    const material = mesh.material as THREE.Material
    const key = `${material.uuid}|${Object.keys(geo.attributes).sort()}|${geo.index !== null}`
    const group = groups.get(key) ?? { material, parts: [] }
    group.parts.push(geo)
    groups.set(key, group)
  })
  const body = new THREE.Group()
  for (const { material, parts } of groups.values()) {
    const merged = mergeGeometries(parts)
    const geos = merged ? [merged] : parts
    for (const g of geos) body.add(new THREE.Mesh(g, material))
  }
  return body
}

/**
 * Transmission glass re-renders the whole scene into a buffer every frame. Tinted
 * clearcoat glass reflects the sky just as well and costs nothing extra.
 */
function tintedGlass(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    name: 'Glass',
    color: 0x0c1418,
    metalness: 0,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

function find(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial {
  let found: THREE.MeshStandardMaterial | undefined
  root.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
    if (mat?.name === name) found = mat
  })
  if (!found) throw new Error(`Car material ${name} not found`)
  return found
}

function paintFor(template: THREE.Object3D, color: number): THREE.MeshStandardMaterial {
  const paint = find(template, BODY_PAINT).clone()
  paint.color.setHex(color)
  // The source paint is fully metallic, which turns every color into tinted chrome.
  // Real paint is a colored base with some flake under the clear coat.
  paint.metalness = 0.5
  paint.roughness = 0.32
  return paint
}

/** Clone sharing geometry; paint per variant, lights per car so each can brake on its own. */
function instance(
  template: THREE.Object3D,
  paint: THREE.MeshStandardMaterial,
  bounds: THREE.Box3,
): CarVisual {
  const root = template.clone(true)
  const headlights = find(root, 'Headlight').clone()
  const brakelights = find(root, 'Brakelight').clone()
  const swap: Record<string, THREE.Material> = {
    [BODY_PAINT]: paint,
    Headlight: headlights,
    Brakelight: brakelights,
  }
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) mesh.material = swap[(mesh.material as THREE.Material).name] ?? mesh.material
  })
  return { root, wheels: wheelsOf(root), headlights, brakelights, bounds }
}

const wheelsOf = (root: THREE.Object3D) => WHEELS.map((n) => root.getObjectByName(`${n}Pivot`)!)

function chassisBounds(root: THREE.Object3D, wheels: THREE.Object3D[]): THREE.Box3 {
  wheels.forEach((w) => (w.visible = false))
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root, true)
  wheels.forEach((w) => (w.visible = true))
  return box
}

/** Fallback: a plain coupe silhouette, so a missing asset never blocks driving. */
function boxCar(color: number): CarVisual {
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
  const headlights = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xdde8ff })
  const brakelights = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xb00000 })
  const root = new THREE.Group()
  const box = (w: number, h: number, d: number, y: number, z: number, m: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(0, y, z)
    mesh.castShadow = true
    root.add(mesh)
  }
  box(1.9, 0.5, 4.3, 0.6, 0.1, paint)
  box(1.6, 0.4, 2, 1.05, -0.2, dark)
  box(1.5, 0.1, 0.05, 0.7, 2.26, headlights)
  box(1.5, 0.1, 0.05, 0.7, -2.06, brakelights)
  const tire = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 20).rotateZ(Math.PI / 2)
  const wheels = [
    [0.98, 1.49],
    [-0.98, 1.49],
    [0.98, -1.31],
    [-0.98, -1.31],
  ].map(([x, z]) => {
    const pivot = new THREE.Group().add(new THREE.Mesh(tire, dark))
    pivot.position.set(x, 0.38, z)
    pivot.rotation.order = 'YXZ'
    root.add(pivot)
    return pivot
  })
  return { root, wheels, headlights, brakelights, bounds: chassisBounds(root, wheels) }
}
