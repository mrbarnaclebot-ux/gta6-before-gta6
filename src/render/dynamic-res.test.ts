import { expect, test } from 'vitest'
import { DynamicRes } from './dynamic-res'

const run = (d: DynamicRes, fps: number, secs: number) => {
  for (let i = 0; i < fps * secs; i++) d.update(1 / fps)
  return d.scale
}

test('drops the scale when slow, recovers slowly, never past the limits', () => {
  const d = new DynamicRes(1)
  expect(run(d, 60, 3)).toBe(1)
  expect(run(d, 40, 1.5)).toBeCloseTo(0.9)
  expect(run(d, 40, 10)).toBeCloseTo(0.5)
  // Held for a few seconds after a drop, then climbs in small steps.
  expect(run(d, 60, 2.5)).toBeCloseTo(0.5)
  const climbing = run(d, 60, 3)
  expect(climbing).toBeGreaterThan(0.5)
  expect(climbing).toBeLessThan(0.7)
  expect(run(d, 60, 30)).toBeCloseTo(1)
  // A climb that is too much for the GPU drops back, and the next climb waits longer.
  const hunt = new DynamicRes(1)
  run(hunt, 50, 1)
  run(hunt, 60, 4)
  expect(hunt.scale).toBeCloseTo(0.95)
  run(hunt, 50, 1)
  expect(hunt.scale).toBeCloseTo(0.85)
  expect(run(hunt, 60, 5)).toBeCloseTo(0.85)
  d.reset(0.75)
  expect(run(d, 60, 5)).toBe(0.75)
})
