import { describe, expect, it } from 'vitest'
import { SEA_LEVEL } from '../city/layout'
import { heightAt } from '../city/terrain'
import { beachProps } from './beach-props'
import { inMarina, planMarina } from './marina-plan'
import { generateLand } from './plan'
import { rng } from '../city/rng'

const land = generateLand(7, 1000)
const plan = planMarina(land)

describe('marina', () => {
  it('moors every boat afloat, its keel and outboard clear of the seabed', () => {
    for (const b of plan.boats) expect(SEA_LEVEL - heightAt(land, b.x, b.z)).toBeGreaterThan(0.9)
  })

  it('starts the pier at the beach, with the deck just above the sand', () => {
    const pier = plan.decks[0]
    const z = (pier.z0 + pier.z1) / 2
    const sand = heightAt(land, pier.x0, z)
    expect(plan.deckY - sand).toBeGreaterThan(0)
    expect(plan.deckY - sand).toBeLessThan(0.45)
  })

  it('keeps every pile clear of the hulls moored beside it', () => {
    for (const b of plan.boats) {
      for (const p of plan.piles) expect(Math.hypot(p.x - b.x, p.z - b.z)).toBeGreaterThan(1.4)
    }
  })

  it('keeps lifeguard towers and umbrellas off the pier', () => {
    expect(beachProps(land, rng(91)).some((p) => inMarina(plan.zone, p.x, p.z))).toBe(false)
  })
})
