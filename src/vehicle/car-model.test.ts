import * as THREE from 'three'
import { expect, test } from 'vitest'
import { findMesh } from './car-model'

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
