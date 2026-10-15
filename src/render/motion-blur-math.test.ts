import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  clampLength,
  distanceFade,
  MAX_BLUR,
  screenVelocity,
  SHUTTER,
  shutterScale,
} from './motion-blur-math'

function viewProj(x: number, yaw = 0): THREE.Matrix4 {
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000)
  cam.position.set(x, 0, 0)
  cam.rotation.y = yaw
  cam.updateMatrixWorld()
  return new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
}

describe('motion blur math', () => {
  it('keeps the same exposure time at any frame rate', () => {
    expect(shutterScale(1 / 60, 1)).toBeCloseTo(0.75)
    expect(shutterScale(1 / 120, 1)).toBeCloseTo(1.5)
    expect(shutterScale(1 / 30, 1)).toBeCloseTo(SHUTTER * 30)
    expect(shutterScale(0, 1)).toBe(0)
    expect(shutterScale(1e-5, 1)).toBe(2)
  })

  it('clamps streaks to the maximum length, keeping direction', () => {
    expect(clampLength(0.01, 0, MAX_BLUR)).toEqual([0.01, 0])
    const [x, y] = clampLength(0.3, 0.4, MAX_BLUR)
    expect(Math.hypot(x, y)).toBeCloseTo(MAX_BLUR)
    expect(x / y).toBeCloseTo(0.75)
  })

  it('keeps the player sharp and blurs the distance', () => {
    expect(distanceFade(4)).toBe(0)
    expect(distanceFade(100)).toBe(1)
    expect(distanceFade(15)).toBeGreaterThan(0)
    expect(distanceFade(15)).toBeLessThan(1)
  })

  it('reprojects a still camera to zero motion', () => {
    const vp = viewProj(0)
    const [vx, vy] = screenVelocity([0.3, 0.6], 0.98, vp.clone().invert(), vp)
    expect(Math.abs(vx) + Math.abs(vy)).toBeLessThan(1e-6)
  })

  it('moves the scene left on screen when the camera moves right', () => {
    const now = viewProj(1)
    const [vx, vy] = screenVelocity([0.5, 0.5], 0.99, now.clone().invert(), viewProj(0))
    expect(vx).toBeLessThan(0)
    expect(Math.abs(vy)).toBeLessThan(1e-6)
  })

  it('moves the scene sideways when the camera turns', () => {
    const now = viewProj(0, 0.05)
    const [vx] = screenVelocity([0.5, 0.5], 1, now.clone().invert(), viewProj(0))
    // Turning left (positive yaw) slides the far scene right across the screen.
    expect(vx).toBeGreaterThan(0.01)
  })
})
