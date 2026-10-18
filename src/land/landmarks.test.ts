import { describe, expect, it } from 'vitest'
import { generateFlora } from './flora'
import { outerLandmarks } from './landmarks'
import { generateLand } from './plan'
import { ROCK_SPREAD } from './plant'

const land = generateLand(7, 1000)
const { rocks } = generateFlora(land)

/** The player's capsule radius (player/player.ts RADIUS). */
const BODY = 0.35

describe('outer landmarks', () => {
  it('stand clear of every rock, so a teleport never lands inside one', () => {
    for (const [name, p] of Object.entries(outerLandmarks(land))) {
      const hit = rocks.find((r) => Math.hypot(r.x - p.x, r.z - p.z) < r.s * ROCK_SPREAD + BODY)
      expect(hit, name).toBeUndefined()
    }
  })
})
