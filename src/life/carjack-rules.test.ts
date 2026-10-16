import { describe, expect, it } from 'vitest'
import {
  canJack,
  driverWaits,
  HOLD_RANGE,
  JACK_RANGE,
  JACK_SPEED,
  jackCrime,
} from './carjack-rules'
import { newWanted, report, stars } from './wanted'

describe('carjacking', () => {
  it('only works on a stopped or crawling car within reach', () => {
    expect(canJack(0, 2, false)).toBe(true)
    expect(canJack(JACK_SPEED - 0.1, 2, false)).toBe(true)
    expect(canJack(JACK_SPEED + 0.1, 2, false)).toBe(false)
    expect(canJack(-1, 2, false)).toBe(true)
    expect(canJack(0, JACK_RANGE + 0.1, false)).toBe(false)
    expect(canJack(0, 1, true)).toBe(false)
  })

  it('makes a slow driver wait for someone walking up, but not a fast one', () => {
    expect(driverWaits(2, HOLD_RANGE - 0.5)).toBe(true)
    expect(driverWaits(10, 1)).toBe(false)
    expect(driverWaits(0, HOLD_RANGE + 1)).toBe(false)
    // Anyone the driver waits for can reach the door.
    expect(HOLD_RANGE).toBeGreaterThan(JACK_RANGE)
  })

  it('is a crime when seen, and a police car is always two stars', () => {
    expect(jackCrime(false, 0)).toBeNull()
    expect(jackCrime(false, 2)).toBe('carjack')
    expect(jackCrime(true, 0)).toBe('copcar')
    const w = newWanted()
    report(w, jackCrime(false, 1)!, 0, 0)
    expect(stars(w)).toBe(1)
    report(w, jackCrime(false, 1)!, 0, 0)
    expect(stars(w)).toBe(2)
    const cop = newWanted()
    report(cop, jackCrime(true, 0)!, 0, 0)
    expect(stars(cop)).toBe(2)
  })
})
