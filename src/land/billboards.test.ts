import { describe, expect, it } from 'vitest'
import { billboardsFor } from './billboards'
import { generateLand } from './plan'

describe('billboardsFor', () => {
  const land = generateLand(7, 1000)
  const boards = billboardsFor(land)

  it('stands some on roofs and some on poles by the highway, showing a billboard picture', () => {
    expect(boards.filter((b) => b.pole).length).toBeGreaterThan(3)
    expect(boards.filter((b) => !b.pole).length).toBeGreaterThan(3)
    for (const b of boards) expect([8, 9]).toContain(b.layer)
  })

  it('puts roof boards on deco roofs only, clear of the stair cores on the others', () => {
    const all = land.blocks.flatMap((k) => k.buildings)
    for (const b of boards.filter((q) => !q.pole)) {
      expect(all.find((h) => h.x === b.x && h.z === b.z)?.style).toBe('deco')
    }
  })

  it('keeps poles off every road', () => {
    for (const b of boards.filter((q) => q.pole)) {
      for (const road of land.paths) {
        const d = Math.min(...road.pts.map((p) => Math.hypot(p.x - b.x, p.z - b.z)))
        expect(d).toBeGreaterThan(road.width / 2 + 4)
      }
    }
  })
})
