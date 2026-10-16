import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { expect, test } from 'vitest'
import { findMesh } from './car-model'
import { CAR_SPECS } from './car-specs'

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

/** The body's size in a shipped glb, read from its JSON chunk: dequantized extent times node scale. */
function shippedSize(url: string): number[] {
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

// Physics and wheels come from CAR_SPECS; a recompressed glb in other units would draw a car
// of the wrong size over the right wheels.
test.each(Object.values(CAR_SPECS))('the shipped $url matches its spec size', (spec) => {
  shippedSize(spec.url).forEach((v, i) => expect(v).toBeCloseTo(spec.size[i], 2))
})
