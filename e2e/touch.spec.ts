import { expect, test, type Page } from '@playwright/test'
import { Fingers } from './fingers'
import { game, LOAD_TIMEOUT, settle, SLOW, visit, type Game } from './helpers'

// A phone on its side (iPhone 14 class): touch, a coarse pointer, and a 3x screen.
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })

// Where the thumbstick lands (left half) and where looking starts (right half, clear of buttons).
const STICK = { x: 170, y: 290 }
const LOOK = { x: 520, y: 140 }

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z)

/** Taps Play and waits for the game, as a phone player would. Returns the page errors. */
async function tapPlay(page: Page, url: string) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(url)
  await page.getByRole('button', { name: 'Play' }).tap()
  await page.waitForFunction(() => '__game' in window, null, { timeout: LOAD_TIMEOUT })
  await settle(page)
  return errors
}

/** Holds the thumbstick pushed up (forward) for `frames` rendered frames. */
async function push(page: Page, fingers: Fingers, frames: number) {
  const id = await fingers.start(STICK)
  await fingers.move(id, { x: STICK.x, y: STICK.y - 70 })
  await settle(page, frames)
  return id
}

test(
  'touch: boots on phone defaults and walks with the stick',
  { tag: '@smoke' },
  async ({ page }) => {
    test.setTimeout(480_000)
    const errors = await tapPlay(page, '/?quality=low')
    await expect(page.locator('.touch')).toBeVisible()
    await expect(page.locator('.desktop-note')).toHaveCount(0)
    const before = await game(page)
    expect(before.device).toBe('touch')
    const fingers = await Fingers.on(page)
    const id = await push(page, fingers, 4)
    await fingers.end(id)
    const moved = distance((await game(page)).position, before.position)
    console.log(`touch walk moved ${moved.toFixed(2)} m`)
    expect(moved).toBeGreaterThan(0.1)
    expect(errors).toEqual([])
  },
)

test('touch: walks, looks, and fires at once, then drives a car', async ({ page }) => {
  test.setTimeout(300_000 * SLOW)
  // No ?quality: a phone's own first-visit default (Low with dynamic resolution).
  const errors = await tapPlay(page, '/')
  const g = await page.evaluate(() => (window as unknown as { __game: Game }).__game.graphics())
  expect(g).toMatchObject({ distance: 'near', dynamicRes: true, bloom: false })
  await visit(page, 'range', 0, 0.18)
  const fingers = await Fingers.on(page)
  const before = await game(page)

  // Three fingers: the stick held forward, a look drag, and a tap on Fire.
  const stick = await push(page, fingers, 2)
  const look = await fingers.start(LOOK)
  await fingers.move(look, { x: LOOK.x + 120, y: LOOK.y }, 6)
  // Through the same finger session: a separate tap would replace the fingers already down.
  const fire = (await page.locator('.tb[data-action="fire"]').boundingBox())!
  await fingers.tap({ x: fire.x + fire.width / 2, y: fire.y + fire.height / 2 })
  await settle(page, 8)
  await fingers.end(look)
  await fingers.end(stick)
  const after = await game(page)
  console.log(
    `moved ${distance(after.position, before.position).toFixed(2)} m, yaw ${before.cameraYaw.toFixed(2)} -> ${after.cameraYaw.toFixed(2)}, shots ${after.shots}`,
  )
  expect(distance(after.position, before.position)).toBeGreaterThan(0.3)
  expect(Math.abs(after.cameraYaw - before.cameraYaw)).toBeGreaterThan(0.1)
  expect(after.shots).toBeGreaterThan(before.shots)
  await page.screenshot({ path: 'test-results/touch-walk.png' })

  await visit(page, 'car', 0.6, 0.2)
  const use = page.locator('.tb[data-action="use"][data-on~="walking"]')
  await expect(use).toHaveClass(/ready/)
  await use.tap()
  await settle(page, 2)
  expect((await game(page)).mode).toBe('driving')
  await expect(page.locator('.tb[data-action="horn"]')).toBeVisible()
  const gas = await push(page, fingers, 12)
  const driving = await game(page)
  await fingers.end(gas)
  console.log(`touch driving at ${driving.speed.toFixed(2)} m/s`)
  expect(driving.speed).toBeGreaterThan(0)
  await page.screenshot({ path: 'test-results/touch-drive.png' })
  expect(errors).toEqual([])
})

test('touch: the map pans and takes a waypoint, pause opens and closes', async ({ page }) => {
  test.setTimeout(240_000 * SLOW)
  const errors = await tapPlay(page, '/?quality=low')
  await page.locator('.tb-map').tap()
  await settle(page, 1)
  await expect(page.locator('#worldmap')).toBeVisible()
  await expect(page.locator('.touch')).toBeHidden()
  await page.locator('#worldmap-canvas').tap({ position: { x: 300, y: 200 } })
  const way = await page.evaluate(() => (window as unknown as { __game: Game }).__game.waypoint())
  expect(way).not.toBeNull()
  await page.screenshot({ path: 'test-results/touch-map.png' })
  await page.getByRole('button', { name: 'Close' }).tap()
  await settle(page, 1)
  await expect(page.locator('#worldmap')).toBeHidden()

  await page.locator('.tb-pause').tap()
  await settle(page, 1)
  expect((await game(page)).paused).toBe(true)
  await page.getByRole('tab', { name: 'Controls' }).tap()
  await expect(page.locator('#keys-title')).toHaveText('Touch')
  await page.screenshot({ path: 'test-results/touch-pause.png' })
  await page.getByRole('button', { name: 'Resume' }).tap()
  await settle(page, 1)
  expect((await game(page)).paused).toBe(false)
  await expect(page.locator('.touch')).toBeVisible()
  expect(errors).toEqual([])
})
