import { expect, test } from 'vitest'
import { generateLand } from '../land/plan'
import { FOUNTAIN, PLANTER, plazaFountain, plazaTrees } from './greenery'
import { KIOSK_CLEAR, plazaFurniture } from './plaza-furniture'
import { contains } from './polygon'

test('plaza benches, bins, and kiosks stand inside a plaza, clear of planters, fountains, and kiosks', () => {
  const city = generateLand(7, 1000)
  const items = plazaFurniture(city)
  const kinds = new Set(items.map((f) => f.kind))
  expect([...kinds].sort()).toEqual(['bench', 'bin', 'kiosk'])
  const plazas = city.blocks.flatMap((b) => b.plazas)
  for (const f of items) {
    const plaza = plazas.find((p) => contains(p, f))!
    expect(plaza).toBeDefined()
    for (const t of plazaTrees(plaza))
      expect(Math.hypot(t.x - f.x, t.z - f.z)).toBeGreaterThan(PLANTER.r)
    const fountain = plazaFountain(plaza)
    if (fountain)
      expect(Math.hypot(fountain.x - f.x, fountain.z - f.z)).toBeGreaterThan(FOUNTAIN.r + 1)
    if (f.kind !== 'bench') continue
    for (const k of items.filter((q) => q.kind === 'kiosk' && contains(plaza, q)))
      expect(Math.hypot(k.x - f.x, k.z - f.z)).toBeGreaterThan(KIOSK_CLEAR)
  }
})

test('a kiosk turns its hatch toward the benches in its plaza', () => {
  const city = generateLand(7, 1000)
  const items = plazaFurniture(city)
  const plazas = city.blocks.flatMap((b) => b.plazas)
  let checked = 0
  for (const k of items.filter((f) => f.kind === 'kiosk')) {
    const plaza = plazas.find((p) => contains(p, k))!
    const benches = items.filter((f) => f.kind === 'bench' && contains(plaza, f))
    if (!benches.length) continue
    const toward = benches.reduce(
      (s, b) => s + Math.sin(k.r) * (b.x - k.x) + Math.cos(k.r) * (b.z - k.z),
      0,
    )
    expect(toward).toBeGreaterThan(0)
    checked++
  }
  expect(checked).toBeGreaterThan(3)
})
