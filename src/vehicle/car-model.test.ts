import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { expect, test } from 'vitest'
import { carModel, findMesh } from './car-bodies'
import { CAR_SPECS, type CarKind } from './car-specs'

async function shipped(kind: CarKind) {
  const data = readFileSync(`public${CAR_SPECS[kind].url}`)
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.parseAsync(new Uint8Array(data).buffer, '')
  return gltf.scene
}

const box = (geo: THREE.BufferGeometry) => {
  geo.computeBoundingBox()
  return geo.boundingBox!
}

// Physics and wheels come from CAR_SPECS; a glb in other units, or a node scale left out of
// the bake (Meshopt moves scale onto nodes), would draw a body of the wrong size over them.
const kinds = Object.keys(CAR_SPECS) as CarKind[]

test.each(kinds.filter((k) => !CAR_SPECS[k].generated))(
  'the shipped %s matches its spec',
  async (kind) => {
    const spec = CAR_SPECS[kind]
    const scene = await shipped(kind)
    const extras = scene.getObjectByName(kind)!.userData
    const w = spec.wheel
    expect([w.radius, w.width, w.x, w.front, w.rear]).toEqual([
      extras.wheel_radius,
      extras.wheel_width,
      extras.wheel_x,
      extras.wheel_front,
      extras.wheel_rear,
    ])
    expect(spec.seat.y).toBeCloseTo(extras.seat[1] - 0.6)
    const model = carModel(scene, kind)
    for (const level of model.levels) {
      const b = box(level.solid)
      // Exhausts and the police push bar stick out a little past the body.
      expect(b.max.z).toBeGreaterThan(spec.front - 0.05)
      expect(b.max.z).toBeLessThan(spec.front + 0.2)
      expect(b.min.z).toBeLessThan(spec.rear + 0.05)
      expect(b.min.z).toBeGreaterThan(spec.rear - 0.2)
      expect(b.max.y).toBeCloseTo(spec.height, 1)
    }
    for (const wheel of model.wheels) {
      const b = box(wheel)
      // The tread sits a few millimeters inside the nominal radius.
      expect(Math.abs(b.max.y - w.radius)).toBeLessThan(0.01)
      expect(Math.abs(b.min.y + w.radius)).toBeLessThan(0.01)
      expect(b.max.x - b.min.x).toBeLessThan(w.width + 0.05)
    }
  },
)

test('a quantized body keeps its size: the node scale is baked into the geometry', () => {
  const root = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
  mesh.scale.setScalar(0.5)
  root.add(mesh)
  const box = new THREE.Box3().setFromBufferAttribute(
    findMesh(root).geometry.getAttribute('position') as THREE.BufferAttribute,
  )
  expect(box.max.x).toBeCloseTo(0.5)
})

/** A generated body's size, read from its JSON chunk: dequantized extent times node scale. */
function generatedSize(url: string): number[] {
  const data = readFileSync(`public${url}`)
  const gltf = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)))
  const node = gltf.nodes.find((n: { mesh?: number }) => n.mesh !== undefined)
  const prim = gltf.meshes[node.mesh].primitives[0]
  const acc = gltf.accessors[prim.attributes.POSITION]
  const unit = acc.normalized
    ? ({ 5120: 127, 5122: 32767 } as Record<number, number>)[acc.componentType]
    : 1
  return acc.max.map((m: number, i: number) => ((m - acc.min[i]) / unit) * (node.scale?.[i] ?? 1))
}

test.each(kinds.filter((k) => CAR_SPECS[k].generated))(
  'the generated %s matches its spec',
  (kind) => {
    const spec = CAR_SPECS[kind]
    generatedSize(spec.url).forEach((v, i) => expect(v).toBeCloseTo(spec.generated!.size[i], 2))
  },
)
