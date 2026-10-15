import { expect, test } from '@playwright/test'
import { game, LOAD_TIMEOUT, play, settle, SLOW, visit, type Game } from './helpers'

test('loads, plays, walks, and stands on the city', { tag: '@smoke' }, async ({ page }) => {
  // The default Medium preset in SwiftShader with people and traffic runs near 1 fps.
  test.setTimeout(180_000 * SLOW)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible()
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => '__game' in window, null, { timeout: LOAD_TIMEOUT })
  await settle(page)
  await expect(page.locator('#title')).toBeHidden()

  const before = await game(page)
  expect(before.mode).toBe('walking')
  await page.keyboard.down('w')
  // Hold for rendered frames, not wall-clock time: SwiftShader runs at about 1 fps
  // and each frame simulates at most 0.1 s, so 12 frames is at least 1.2 s of walking.
  await settle(page, 12)
  await page.keyboard.up('w')
  const after = await game(page)
  const moved = Math.hypot(
    after.position.x - before.position.x,
    after.position.z - before.position.z,
  )
  console.log(`moved ${moved.toFixed(2)} m at ${after.fps} fps`)
  expect(moved).toBeGreaterThan(0.5)
  await page.screenshot({ path: 'test-results/smoke.png' })

  await visit(page, 'beach', -1.2, 0.12)
  await page.screenshot({ path: 'test-results/beach.png' })
  await visit(page, 'rooftop', 2.3, 0.5)
  await page.screenshot({ path: 'test-results/city.png' })
  expect(errors).toEqual([])
})

test('swims in the ocean and dives under', async ({ page }) => {
  test.setTimeout(180_000 * SLOW)
  const errors = await play(page, '/')

  await visit(page, 'ocean', -1.2, 0.15)
  const floating = await game(page)
  expect(floating.mode).toBe('swimming')
  await page.screenshot({ path: 'test-results/swim.png' })

  // A level camera follows the diver under the surface.
  await page.evaluate(() => (window as unknown as { __game: Game }).__game.setCameraPitch(0))
  await page.keyboard.down('Control')
  await settle(page, 14)
  await page.keyboard.up('Control')
  const dived = await game(page)
  console.log(`dived to y ${dived.position.y.toFixed(2)}, breath ${dived.breath.toFixed(1)}`)
  expect(dived.mode).toBe('swimming')
  expect(dived.position.y).toBeLessThan(floating.position.y - 0.5)
  expect(dived.underwater).toBe(true)
  await page.screenshot({ path: 'test-results/underwater.png' })
  expect(errors).toEqual([])
})

test('gets into a parked car and drives it', { tag: '@smoke' }, async ({ page }) => {
  // SwiftShader draws a dozen detailed cars at well under 1 fps; Low skips post-processing.
  test.setTimeout(180_000 * SLOW)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?quality=low')
  // Space on the focused Play button must start the game, not be swallowed as a game key.
  await page.getByRole('button', { name: 'Play' }).press('Space')
  await page.waitForFunction(() => '__game' in window, null, { timeout: LOAD_TIMEOUT })
  await settle(page)

  await visit(page, 'car', 0.6, 0.2)
  await expect(page.locator('#prompt')).toBeVisible()
  await page.keyboard.press('f')
  await settle(page, 2)
  expect((await game(page)).mode).toBe('driving')
  await expect(page.locator('#speedo')).toBeVisible()

  await page.keyboard.down('w')
  await settle(page, 12)
  const driving = await game(page)
  await page.keyboard.up('w')
  console.log(`driving at ${driving.speed.toFixed(2)} m/s`)
  expect(driving.mode).toBe('driving')
  expect(driving.speed).toBeGreaterThan(0)
  await page.screenshot({ path: 'test-results/drive.png' })

  await page.keyboard.press('f')
  await settle(page, 2)
  expect((await game(page)).mode).toBe('walking')
  expect(errors).toEqual([])
})

test('aims and shoots a target dummy', { tag: '@smoke' }, async ({ page }) => {
  test.setTimeout(180_000 * SLOW)
  const errors = await play(page, '/?quality=low')

  await visit(page, 'range', 0, 0.18)
  await expect(page.locator('#ammo')).toBeVisible()
  // No pointer lock here: hold the right button without moving, so drag-to-look stays idle.
  await page.mouse.move(640, 360)
  await page.mouse.down({ button: 'right' })
  await settle(page, 4)
  expect((await game(page)).aiming).toBe(true)
  await expect(page.locator('#crosshair')).toBeVisible()

  const aim = () =>
    page.evaluate(() => {
      const g = (window as unknown as { __game: Game }).__game
      const d = g.dummies()[1]
      g.aimAt(d.x, d.y, d.z)
      return d.health
    })
  // The shoulder camera eases in over a few frames; re-aim once it has settled.
  await aim()
  await settle(page, 2)
  const before = await aim()
  await settle(page, 1)
  const ammo = (await game(page)).ammo
  await page.mouse.down()
  await page.mouse.up()
  await settle(page, 2)
  const after = await page.evaluate(
    () => (window as unknown as { __game: Game }).__game.dummies()[1].health,
  )
  await page.mouse.up({ button: 'right' })
  console.log(`dummy health ${before} -> ${after}`)
  expect(after).toBeLessThan(before)
  expect((await game(page)).ammo).toBe(ammo - 1)
  await page.screenshot({ path: 'test-results/shoot.png' })
  expect(errors).toEqual([])
})
