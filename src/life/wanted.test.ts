import { describe, expect, it } from 'vitest'
import {
  clear,
  cool,
  COOL_DELAY,
  COOL_RATE,
  cooling,
  MAX_STARS,
  newWanted,
  report,
  searchRadius,
  stars,
} from './wanted'

/** Steps the cooling clock in 0.1 s ticks with the player standing at (x, 0). */
function wait(w: ReturnType<typeof newWanted>, seconds: number, x: number) {
  for (let t = 0; t < seconds; t += 0.1) cool(w, x, 0, 0.1)
}

describe('wanted level', () => {
  it('starts clean', () => {
    expect(stars(newWanted())).toBe(0)
  })

  it('gives one star for the first gunshot and a second after a few more', () => {
    const w = newWanted()
    report(w, 'gunshot', 0, 0)
    expect(stars(w)).toBe(1)
    report(w, 'gunshot', 0, 0)
    report(w, 'gunshot', 0, 0)
    expect(stars(w)).toBe(1)
    report(w, 'gunshot', 0, 0)
    expect(stars(w)).toBe(2)
  })

  it('caps at five stars', () => {
    const w = newWanted()
    for (let i = 0; i < 20; i++) report(w, 'murder', 0, 0)
    expect(stars(w)).toBe(MAX_STARS)
  })

  it('holds while the player stays inside the search area', () => {
    const w = newWanted()
    report(w, 'murder', 0, 0)
    report(w, 'murder', 0, 0)
    wait(w, 120, 10)
    expect(stars(w)).toBe(2)
    expect(cooling(w)).toBe(false)
  })

  it('drops one star per interval once out of sight, after a delay', () => {
    const w = newWanted()
    report(w, 'murder', 0, 0)
    report(w, 'murder', 0, 0)
    const away = searchRadius(w) + 50
    wait(w, COOL_DELAY + COOL_RATE - 1, away)
    expect(stars(w)).toBe(2)
    expect(cooling(w)).toBe(true)
    wait(w, 1.5, away)
    expect(stars(w)).toBe(1)
    wait(w, COOL_RATE + 0.5, away)
    expect(stars(w)).toBe(0)
    expect(cooling(w)).toBe(false)
  })

  it('restarts the clock and the search area on a new crime', () => {
    const w = newWanted()
    report(w, 'gunshot', 0, 0)
    wait(w, COOL_DELAY + COOL_RATE - 1, 500)
    report(w, 'gunshot', 500, 0)
    expect(w.unseen).toBe(0)
    wait(w, 60, 500)
    expect(stars(w)).toBe(1)
  })

  it('clears on death', () => {
    const w = newWanted()
    report(w, 'murder', 3, 4)
    clear(w)
    expect(stars(w)).toBe(0)
  })
})
