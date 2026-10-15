import * as THREE from 'three'
import { expect, test } from 'vitest'
import { aoPass } from './ao-pass'

const sea = () =>
  new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ transparent: true }))

test('transparency mode stays off with a transparent sea, added before or after', () => {
  const camera = new THREE.PerspectiveCamera()
  const before = new THREE.Scene().add(sea())
  expect(aoPass(before, camera, 64, 64).configuration.transparencyAware).toBe(false)
  const later = new THREE.Scene()
  const ao = aoPass(later, camera, 64, 64)
  later.add(sea())
  ao.detectTransparency()
  expect(ao.configuration.transparencyAware).toBe(false)
})
