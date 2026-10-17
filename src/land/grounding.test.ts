import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Spot } from '../city/layout'
import { CAR_HALF, drivewaySpots, parkingSpots } from '../city/parking'
import { heightAt, surfaceAt } from '../city/terrain'
import { beachProps, PROP_RADIUS } from './beach-props'
import { generateFlora } from './flora'
import { corners, type Surface } from './footing'
import { CELL } from './grid'
import { generateLand } from './plan'
import { GARDEN_TRUNK, ROCK_RIM, ROCK_SPREAD, SINK, TRUNK } from './plant'
import { rng } from '../city/rng'

/*
 * Nothing floats: every placed instance is checked against the ground under its footprint.
 * Upright things may sink (by their allowance) but no point of their footprint may sit more
 * than 5 cm below their base.
 */

const land = generateLand(7, 1000)
const t0 = performance.now()
const flora = generateFlora(land)
const floraMs = performance.now() - t0
const surface: Surface = (x, z) => surfaceAt(land, x, z)
const FLOAT = 0.05

/** Ground under a round footprint: the center and a ring of 16 points. */
function footprint(f: Surface, x: number, z: number, r: number) {
  const hs = [f(x, z)]
  for (let k = 0; k < 16 && r > 0; k++) {
    const a = (k / 16) * Math.PI * 2
    hs.push(f(x + r * Math.cos(a), z + r * Math.sin(a)))
  }
  return { low: Math.min(...hs), high: Math.max(...hs) }
}

/** Every spot touches down (lowest ground within 5 cm of the base) and is buried no deeper than `sink`. */
function expectStanding(name: string, spots: Spot[], radius: (s: Spot) => number, sink: number) {
  let worst = { float: -Infinity, buried: -Infinity }
  for (const s of spots) {
    const g = footprint(surface, s.x, s.z, radius(s))
    worst = {
      float: Math.max(worst.float, s.y! - g.low),
      buried: Math.max(worst.buried, g.low - s.y!),
    }
  }
  expect(worst.float, `${name} floats`).toBeLessThanOrEqual(FLOAT)
  expect(worst.buried, `${name} buried`).toBeLessThanOrEqual(sink + FLOAT)
}

describe('grounding', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('samples the ground on the same triangles the physics heightfield collides with', () => {
    const g = land.ground
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const w = g.nx * CELL
    const d = g.nz * CELL
    const desc = RAPIER.ColliderDesc.heightfield(g.nz, g.nx, g.h, { x: w, y: 1, z: d })
    world.createCollider(desc.setTranslation(g.x0 + w / 2, 0, g.z0 + d / 2))
    world.step()
    const r = rng(3)
    for (let k = 0; k < 400; k++) {
      const x = g.x0 + 10 + r() * (w - 20)
      const z = g.z0 + 10 + r() * (d - 20)
      const hit = world.castRay(new RAPIER.Ray({ x, y: 400, z }, { x: 0, y: -1, z: 0 }), 800, true)
      expect(Math.abs(400 - hit!.timeOfImpact - heightAt(land, x, z))).toBeLessThan(0.005)
    }
  })

  it('plants every tree, palm, and bush on the ground', () => {
    console.log(
      `flora in ${floraMs.toFixed(0)} ms:`,
      Object.entries(flora)
        .map(([k, v]) => `${k} ${v.length}`)
        .join(', '),
    )
    expectStanding('conifers', flora.conifers, (s) => TRUNK * s.s, SINK.tree)
    expectStanding('broadleaf', flora.broadleaf, (s) => TRUNK * s.s, SINK.tree)
    expectStanding('garden', flora.garden, (s) => GARDEN_TRUNK * s.s, SINK.tree)
    expectStanding('palms', [...flora.palms, ...land.palms], () => 0.3, SINK.palm)
    expectStanding('bushes', flora.bushes, (s) => 0.12 * s.s, SINK.bush)
    expectStanding('city ferns', land.bushes, () => 0.1, SINK.bush)
    expectStanding('streetlights', land.lights, () => 0.2, 0)
  })

  it('lays every rock with the slope, its rim touching down', () => {
    for (const s of flora.rocks) {
      const [ux, uy, uz] = s.up!
      const r = s.s * ROCK_SPREAD * ROCK_RIM
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2
        const px = s.x + r * Math.cos(a)
        const pz = s.z + r * Math.sin(a)
        const base = s.y! - (ux * (px - s.x) + uz * (pz - s.z)) / uy
        expect(base - surface(px, pz)).toBeLessThanOrEqual(FLOAT)
      }
      expect(surface(s.x, s.z) - s.y!).toBeLessThanOrEqual(SINK.rock * s.s + s.s * 0.5)
    }
  })

  it('stands the beach towers and umbrellas on the sand', () => {
    const props = beachProps(land, rng(91))
    expect(props.length).toBeGreaterThan(20)
    for (const p of props) {
      const g = footprint((x, z) => heightAt(land, x, z), p.x, p.z, PROP_RADIUS[p.kind])
      expect(p.y - g.low).toBeLessThanOrEqual(FLOAT)
      expect(p.y - g.low).toBeGreaterThanOrEqual(-FLOAT)
    }
  })

  it('parks every car with all four wheels on the ground', () => {
    const cars = [...parkingSpots(land, 14, 4), ...drivewaySpots(land, 6, 4)]
    for (const c of cars) {
      corners(c.x, c.z, c.yaw, CAR_HALF.l, CAR_HALF.w).forEach((p, i) => {
        const f = i < 2 ? 1 : -1
        const s = i % 2 ? 1 : -1
        // The corner's height on the tilted car: pitch along the heading, roll across it.
        const y = c.y + f * CAR_HALF.l * Math.tan(c.pitch) - s * CAR_HALF.w * Math.tan(c.roll)
        const g = surface(p.x, p.z)
        expect(y - g).toBeLessThanOrEqual(FLOAT)
        expect(g - y).toBeLessThanOrEqual(0.15)
      })
    }
  })

  it('keeps plants off roads and out of the water, and is the same every time', () => {
    const trees = [...flora.conifers, ...flora.broadleaf]
    const r = rng(5)
    // Every bush: a corner lot's hedge once ran on into the side street.
    const sample = Array.from({ length: 1500 }, () => trees[Math.floor(r() * trees.length)])
    for (const s of [...sample, ...flora.bushes]) {
      expect(s.y!).toBeGreaterThan(-1)
      for (const p of land.paths.filter((q) => q.kind !== 'trail')) {
        const near = p.pts.some((q) => Math.hypot(q.x - s.x, q.z - s.z) < p.width / 2)
        if (near) throw new Error(`plant on ${p.name} at ${s.x}, ${s.z}`)
      }
    }
    expect(flora.conifers.length).toBeGreaterThan(5000)
    expect(generateFlora(land).rocks).toEqual(flora.rocks)
  })
})
