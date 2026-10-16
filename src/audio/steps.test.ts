import { describe, expect, it } from 'vitest'
import { StepDetector } from './steps'

/** Feet swinging like a walk at `hz` strides a second, half a stride apart, for `seconds`. */
function walk(hz: number, seconds: number) {
  const d = new StepDetector()
  const steps: number[] = []
  for (let t = 0; t < seconds; t += 1 / 60) {
    const swing = (phase: number) => 0.08 + 0.07 * Math.sin(2 * Math.PI * (hz * t + phase))
    const foot = d.update([swing(0), swing(0.5)], 1 / 60)
    if (foot >= 0) steps.push(foot)
  }
  return steps
}

describe('StepDetector', () => {
  it('calls one step per foot per stride, alternating', () => {
    const steps = walk(0.9, 5)
    // 0.9 strides a second for 5 s is 9 steps; the first stride is spent learning the swing.
    expect(steps.length).toBeGreaterThanOrEqual(7)
    expect(steps.length).toBeLessThanOrEqual(10)
    for (let i = 1; i < steps.length; i++) expect(steps[i]).not.toBe(steps[i - 1])
  })

  it('is silent while standing still', () => {
    const d = new StepDetector()
    let any = false
    for (let i = 0; i < 300; i++) any ||= d.update([0.08, 0.08], 1 / 60) >= 0
    expect(any).toBe(false)
  })
})
