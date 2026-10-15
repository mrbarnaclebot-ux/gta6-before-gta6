import { expect, test } from 'vitest'
import { heightFactor } from './height-fog'

test('haze is thickest at sea level and thins with altitude', () => {
  expect(heightFactor(0, 0)).toBeCloseTo(1)
  // Looking up at a tower top crosses thinner air than looking along the street.
  expect(heightFactor(2, 150)).toBeLessThan(0.6)
  // Looking down from a rooftop crosses thicker air below.
  expect(heightFactor(120, -118)).toBeGreaterThan(heightFactor(120, 0))
  // Continuous across the near-level special case.
  expect(heightFactor(10, 0.05)).toBeCloseTo(heightFactor(10, 0), 3)
})
