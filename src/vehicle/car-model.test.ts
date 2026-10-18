import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { expect, test } from 'vitest'
import { carModel } from './car-model'
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
test.each(Object.keys(CAR_SPECS) as CarKind[])('the shipped %s matches its spec', async (kind) => {
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
})
