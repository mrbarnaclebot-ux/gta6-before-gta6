import { expect, test, type Page } from '@playwright/test'

type GameState = {
  position: { x: number; y: number; z: number }
  frames: number
  mode: string
  fps: number
}

const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __game: { state: () => GameState } }).__game.state())

test('loads, plays, and walks forward', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible()
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => '__game' in window, null, { timeout: 60_000 })
  await page.waitForFunction(
    () => (window as unknown as { __game: { state: () => GameState } }).__game.state().frames > 5,
  )
  await expect(page.locator('#title')).toBeHidden()

  const before = await state(page)
  expect(before.mode).toBe('walking')
  await page.keyboard.down('w')
  await page.waitForTimeout(1000)
  await page.keyboard.up('w')
  const after = await state(page)

  const moved = Math.hypot(
    after.position.x - before.position.x,
    after.position.z - before.position.z,
  )
  // Low bar on purpose: SwiftShader renders the High preset at a few fps and the
  // simulation clamps long frames, so 1 s of input covers well under 1 s of walking.
  console.log(`moved ${moved.toFixed(2)} m at ${after.fps} fps`)
  expect(moved).toBeGreaterThan(0.1)
  await page.screenshot({ path: 'test-results/smoke.png' })
  expect(errors).toEqual([])
})
