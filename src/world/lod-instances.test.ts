import * as THREE from 'three'
import { expect, test } from 'vitest'
import type { WorldCtx } from './blocks'
import { instanceByDistance } from './lod-instances'

const part = () => [{ geometry: new THREE.BoxGeometry(), material: new THREE.MeshBasicMaterial() }]

test('each spot draws near or far by its own distance, and re-sorts once the eye moves', () => {
  const scene = new THREE.Scene()
  const spots = [0, 30, 60, 90].map((x) => ({ x, z: 0, s: 1, r: 0 }))
  const update = instanceByDistance({ scene } as WorldCtx, part(), part(), spots, {
    scale: () => 1,
    ground: () => 0,
    far: 50,
  })
  const [near, far] = scene.children as THREE.InstancedMesh[]
  const xs = (m: THREE.InstancedMesh) =>
    Array.from({ length: m.count }, (_, i) => m.instanceMatrix.array[i * 16 + 12])

  update(new THREE.Vector3(0, 0, 0))
  expect(xs(near)).toEqual([0, 30])
  expect(xs(far)).toEqual([60, 90])

  // A small step is not worth a re-sort.
  update(new THREE.Vector3(2, 0, 0))
  expect(xs(near)).toEqual([0, 30])

  update(new THREE.Vector3(90, 0, 0))
  expect(xs(near)).toEqual([60, 90])
  expect(xs(far)).toEqual([0, 30])
  expect(near.visible && far.visible).toBe(true)

  update(new THREE.Vector3(1000, 0, 0))
  expect(near.visible).toBe(false)
})
