import * as THREE from 'three'
import { expect, test } from 'vitest'
import { splitByTile } from './chunks'

test('splits triangles by the tile their centroid is in, keeping every attribute', () => {
  const geo = new THREE.BufferGeometry()
  // One triangle near the origin, one 300 m east, one straddling x = 256 (centroid at 250).
  const p = [
    0, 0, 0, 10, 0, 0, 0, 0, 10, 300, 0, 0, 310, 0, 0, 300, 0, 10, 240, 0, 0, 270, 0, 0, 240, 0, 5,
  ]
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  geo.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      new Array(18).fill(0).map((_, i) => i),
      2,
    ),
  )
  const parts = splitByTile(geo, 256)
  expect(parts.map((g) => g.attributes.position.count).sort()).toEqual([3, 6])
  const east = parts.find((g) => g.attributes.position.count === 3)!
  expect(east.attributes.position.getX(0)).toBe(300)
  expect(east.attributes.uv.getX(0)).toBe(6)
})
