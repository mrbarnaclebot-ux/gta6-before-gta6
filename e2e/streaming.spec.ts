import { expect, test, type Page } from '@playwright/test'
import { game, play, settle, SLOW, type Game, type Point } from './helpers'

type Streaming = Game & {
  lane: (name: string, side?: number) => Point[] | null
  collidersNear: (x: number, z: number, r: number) => number
  probe: (x: number, y: number, z: number) => number | null
}
type State = { colliders: number; tiles: number; queued: number }

const hook = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __game: Game }).__game.state() as unknown as State
    return { colliders: s.colliders, tiles: s.tiles, queued: s.queued }
  })

// Small static colliders (trunks, posts, buildings) stream in 128 m tiles around the player.
test('drives across tile borders and lands on loaded colliders after a long teleport', async ({
  page,
}) => {
  test.setTimeout(480_000 * SLOW)
  const errors = await play(page, '/?quality=low')
  const start = await hook(page)
  expect(start.colliders).toBeGreaterThan(0)

  // Into the parked car, then along the highway in 90 m hops: several tile borders each way.
  await page.evaluate(() => {
    const G = (window as unknown as { __game: Game }).__game
    const c = G.landmarks().car
    G.teleport(c.x, c.y, c.z)
  })
  await settle(page, 4)
  await page.keyboard.press('f')
  await page.waitForFunction(
    () => (window as unknown as { __game: Game }).__game.state().mode === 'driving',
    null,
    { timeout: 60_000 * SLOW },
  )
  const lane = await page.evaluate(() =>
    (window as unknown as { __game: Streaming }).__game.lane('highway', 4.9),
  )
  expect(lane && lane.length).toBeGreaterThan(10)
  const seen = new Set<number>()
  let walked = 0
  for (let i = 1; i < lane!.length && walked < 700; i++) {
    walked += Math.hypot(lane![i].x - lane![i - 1].x, lane![i].z - lane![i - 1].z)
    if (i % 6) continue
    await page.evaluate(
      (p) => (window as unknown as { __game: Game }).__game.teleport(p.x, p.y + 0.6, p.z),
      lane![i],
    )
    await page.keyboard.down('w')
    await settle(page, 3)
    await page.keyboard.up('w')
    seen.add((await hook(page)).colliders)
  }
  expect((await game(page)).mode).toBe('driving')
  // Different tiles came and went on the way.
  expect(seen.size).toBeGreaterThan(2)

  // Out of the car and 2 km away to the forest: trunks and ground are there at once.
  await page.keyboard.press('f')
  await settle(page, 6)
  const spot = await page.evaluate(() => {
    const G = (window as unknown as { __game: Game }).__game
    const f = G.landmarks().forest
    G.teleport(f.x, f.y + 0.3, f.z)
    return f
  })
  await settle(page, 10)
  const after = await page.evaluate(
    ([x, y, z]) => {
      const G = (window as unknown as { __game: Streaming }).__game
      return { trunks: G.collidersNear(x, z, 40), ground: G.probe(x, y, z) }
    },
    [spot.x, spot.y, spot.z],
  )
  console.log(`forest: ${after.trunks} colliders within 40 m, ground at ${after.ground}`)
  expect(after.trunks).toBeGreaterThan(0)
  expect(after.ground).not.toBeNull()
  const s = await game(page)
  expect(Math.abs(s.position.y - spot.y)).toBeLessThan(0.5)
  expect(errors).toEqual([])
})
