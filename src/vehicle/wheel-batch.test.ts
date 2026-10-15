import * as THREE from 'three'
import { expect, test } from 'vitest'
import { WheelBatch } from './wheel-batch'

test('copies each visible car wheel into the batch, turned round on the right side', () => {
  const batch = new WheelBatch(0.3, 0.2)
  const scene = new THREE.Scene()
  const cars = [new THREE.Group(), new THREE.Group()]
  cars.forEach((car, i) => {
    car.position.x = i * 10
    const left = new THREE.Object3D()
    const right = new THREE.Object3D()
    right.position.x = -1
    car.add(left, right)
    batch.add(left, car, false)
    batch.add(right, car, true)
    scene.add(car)
  })
  cars[0].visible = false
  scene.updateMatrixWorld()
  batch.sync()

  const [tire] = batch.meshes
  expect(tire.count).toBe(2)
  const m = new THREE.Matrix4()
  tire.getMatrixAt(0, m)
  expect(new THREE.Vector3().setFromMatrixPosition(m).x).toBe(10)
  tire.getMatrixAt(1, m)
  // The flipped wheel's axle (+x) points the other way.
  expect(new THREE.Vector3(1, 0, 0).transformDirection(m).x).toBeCloseTo(-1)
  expect(new THREE.Vector3().setFromMatrixPosition(m).x).toBe(9)
})
