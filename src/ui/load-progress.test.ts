import { expect, it } from 'vitest'
import { LoadProgress } from './load-progress'

it('fills by step, counts files, never goes back, and ends at 100%', () => {
  const p = new LoadProgress()
  expect(p.value).toBe(0)
  p.finish('code')
  p.finish('physics')
  const before = p.value
  p.files(1, 4)
  expect(p.value).toBeGreaterThan(before)
  expect(p.status).toContain('1 of 4')
  const mid = p.value
  // A newly queued file grows the total; the bar holds instead of dropping.
  p.files(1, 10)
  expect(p.value).toBe(mid)
  p.files(10, 10)
  p.finish('files')
  p.finish('world')
  expect(p.status).toBe('Compiling shaders')
  p.finish('shaders')
  expect(p.value).toBeCloseTo(1)
  expect(p.status).toBe('Ready')
})
