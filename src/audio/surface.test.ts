import { describe, expect, it } from 'vitest'
import { groundOf } from './surface'

const at = (o: Partial<Parameters<typeof groundOf>[0]>) =>
  groundOf({ city: false, lawn: false, road: false, inland: 100, ...o })

describe('groundOf', () => {
  it('is concrete on city sidewalks and roads, grass on its lawns', () => {
    expect(at({ city: true })).toBe('concrete')
    expect(at({ city: true, lawn: true })).toBe('grass')
  })

  it('is sand by the coast and grass inland, unless on a road', () => {
    expect(at({ inland: -20 })).toBe('sand')
    expect(at({ inland: 3 })).toBe('sand')
    expect(at({ inland: 40 })).toBe('grass')
    expect(at({ inland: 40, road: true })).toBe('concrete')
  })
})
