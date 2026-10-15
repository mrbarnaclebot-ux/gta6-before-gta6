import { expect, test, type Page } from '@playwright/test'
import { game, play, settle, type Game, type Point } from './helpers'

/** Runs `fn` against window.__game in the page. `fn` must not close over test variables. */
const hook = <T>(page: Page, fn: (g: Game) => T) =>
  page.evaluate(`(${fn.toString()})(window.__game)`) as Promise<T>

async function peopleAndTraffic(page: Page) {
  expect((await hook(page, (g) => g.peds())).length).toBeGreaterThan(5)
  const before = await hook(page, (g) => g.traffic())
  expect(before.length).toBeGreaterThan(3)
  await settle(page, 4)
  const after = await hook(page, (g) => g.traffic())
  // Match by id: cars despawn and respawn, so list positions shift.
  const moved = after.some((c) => {
    const was = before.find((b) => b.id === c.id)
    return was && Math.hypot(c.x - was.x, c.z - was.z) > 0.3
  })
  expect(moved).toBe(true)
}

/** Shooting a passer-by earns a star and sends people running. */
async function shootPasserBy(page: Page) {
  await hook(page, (g) => {
    const s = g.state().position
    const d = (p: Point) => Math.hypot(p.x - s.x, p.z - s.z)
    const ped = g.peds().sort((a, b) => d(a) - d(b))[0]
    g.teleport(ped.x + 4, ped.y - 1, ped.z + 4)
  })
  await settle(page, 2)
  await hook(page, (g) => {
    const s = g.state().position
    const d = (p: Point) => Math.hypot(p.x - s.x, p.z - s.z)
    const ped = g.peds().sort((a, b) => d(a) - d(b))[0]
    g.aimAt(ped.x, ped.y, ped.z)
  })
  await page.mouse.move(640, 360)
  await page.mouse.down()
  await page.mouse.up()
  // A hip-fire click waits for the body to turn and the gun to come up.
  await settle(page, 8)
  expect((await game(page)).wanted).toBeGreaterThan(0)
  await expect(page.locator('#wanted')).toBeVisible()
  const states = (await hook(page, (g) => g.peds())).map((p) => p.state)
  console.log(`wanted ${(await game(page)).wanted}, people: ${states.join(' ')}`)
  expect(states.some((s) => s === 'flee' || s === 'dead')).toBe(true)
}

/** Dying shows the death screen, then the player wakes up at the nearest hospital. */
async function dieAndRevive(page: Page) {
  await hook(page, (g) => g.hurt(1000))
  await settle(page, 2)
  expect((await game(page)).dead).toBe(true)
  await expect(page.locator('#death')).toBeVisible()
  await hook(page, (g) => g.skipDeath())
  await settle(page, 3)
  const revived = await game(page)
  expect(revived.dead).toBe(false)
  expect(revived.health).toBe(100)
  expect(revived.wanted).toBe(0)
  const hospitals = await hook(page, (g) => g.hospitals())
  const p = revived.position
  const gap = Math.min(...hospitals.map((h) => Math.hypot(h.x - p.x, h.z - p.z)))
  expect(gap).toBeLessThan(2)
}

/** Esc pauses: the clock stops, and the sensitivity setting persists. */
async function pauseMenu(page: Page) {
  await page.keyboard.press('Escape')
  await settle(page, 2)
  await expect(page.locator('#pause')).toBeVisible()
  const pausedAt = (await game(page)).hours
  await settle(page, 3)
  expect((await game(page)).paused).toBe(true)
  expect((await game(page)).hours).toBe(pausedAt)
  await page.locator('#sensitivity').fill('2')
  expect((await game(page)).sensitivity).toBe(2)
  expect(await page.evaluate(() => localStorage.getItem('vice.sensitivity'))).toBe('2')
  await page.screenshot({ path: 'test-results/pause.png' })
  await page.keyboard.press('Escape')
  await settle(page, 2)
  await expect(page.locator('#pause')).toBeHidden()
}

test('people, traffic, wanted level, death, pause menu, and night', async ({ page }) => {
  test.setTimeout(300_000)
  const errors = await play(page, '/?quality=low')
  await expect(page.locator('#minimap')).toBeVisible()

  await peopleAndTraffic(page)
  await shootPasserBy(page)
  await dieAndRevive(page)
  await pauseMenu(page)

  // Night: street lights and neon come on.
  await hook(page, (g) => g.setTime(22))
  await settle(page, 3)
  expect((await game(page)).night).toBeGreaterThan(0.9)
  await page.screenshot({ path: 'test-results/night.png' })
  expect(errors).toEqual([])
})
