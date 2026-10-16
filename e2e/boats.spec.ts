import { expect, test, type Page } from '@playwright/test'
import { game, play, settle, SLOW, type Game } from './helpers'

/** Stands in a cruising traffic car's lane until it stops. Returns its pool id, or null. */
async function stopACar(page: Page): Promise<number | null> {
  for (let tries = 0; tries < 6; tries++) {
    const id = await page.evaluate(() => {
      const g = (window as unknown as { __game: Game }).__game
      const car = g.traffic().find((c) => c.speed > 8)
      if (!car) return null
      const x = car.x + Math.sin(car.heading) * 22
      const z = car.z + Math.cos(car.heading) * 22
      g.teleport(x, g.ground(x, z) + 0.2, z)
      return car.id
    })
    if (id === null) {
      await settle(page, 10)
      continue
    }
    for (let i = 0; i < 25; i++) {
      await settle(page, 3)
      const car = await page.evaluate(
        (n) => (window as unknown as { __game: Game }).__game.traffic().find((c) => c.id === n),
        id,
      )
      if (car && car.speed < 0.3) return id
    }
  }
  return null
}

test('pulls a driver out of a stopped traffic car and drives it away', async ({ page }) => {
  test.setTimeout(300_000 * SLOW)
  const errors = await play(page, '/?quality=low')
  const id = await stopACar(page)
  expect(id, 'a traffic car stopped for the player').not.toBeNull()
  // Step up beside the driver's door (the car's +x side) and press F.
  await page.evaluate((n) => {
    const g = (window as unknown as { __game: Game }).__game
    const c = g.traffic().find((t) => t.id === n)!
    const x = c.x + Math.cos(c.heading) * 2.4 + Math.sin(c.heading) * 1.5
    const z = c.z - Math.sin(c.heading) * 2.4 + Math.cos(c.heading) * 1.5
    g.teleport(x, g.ground(x, z) + 0.2, z)
    g.setCameraYaw(c.heading + 2.2)
  }, id)
  await settle(page, 3)
  await page.keyboard.press('f')
  await page.waitForFunction(
    () => (window as unknown as { __game: Game }).__game.state().carjack === 'pull',
    null,
    { timeout: 120_000 * SLOW },
  )
  await page.screenshot({ path: 'test-results/carjack.png' })
  await page.waitForFunction(
    () => (window as unknown as { __game: Game }).__game.state().mode === 'driving',
    null,
    { timeout: 120_000 * SLOW },
  )
  expect((await game(page)).vehicle).toBe('car')
  const start = (await game(page)).position
  await page.keyboard.down('w')
  await settle(page, 30)
  await page.keyboard.up('w')
  const s = await game(page)
  expect(Math.hypot(s.position.x - start.x, s.position.z - start.z)).toBeGreaterThan(3)
  expect(errors).toEqual([])
})

test('boards a speedboat at the marina, drives it out, and swims off it', async ({ page }) => {
  test.setTimeout(300_000 * SLOW)
  const errors = await play(page, '/?quality=low')
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game
    const at = g.landmarks().marina
    g.teleport(at.x, at.y + 0.3, at.z)
  })
  await settle(page, 6)
  await page.keyboard.press('f')
  await settle(page, 3)
  let s = await game(page)
  expect(s.vehicle).toBe('boat')
  const start = s.position
  await page.keyboard.down('w')
  await settle(page, 60)
  await page.screenshot({ path: 'test-results/boat.png' })
  await page.keyboard.up('w')
  s = await game(page)
  expect(Math.hypot(s.position.x - start.x, s.position.z - start.z)).toBeGreaterThan(15)
  // Afloat: the hull's waterline stays within the swell of sea level (-1.2 m).
  expect(Math.abs(s.position.y + 1.2)).toBeLessThan(0.8)
  await page.keyboard.press('f')
  await settle(page, 6)
  expect((await game(page)).mode).toBe('swimming')
  expect(errors).toEqual([])
})
