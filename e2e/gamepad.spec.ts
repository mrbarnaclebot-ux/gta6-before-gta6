import { expect, test, type Page } from '@playwright/test'
import { game, LOAD_TIMEOUT, settle, SLOW, visit } from './helpers'

// Standard-mapping indices: A 0, Y 3, RT 7, Start 9, D-pad up 12, down 13, right 15. Left stick is axes 0 and 1.
const A = 0
const Y = 3
const RT = 7
const START = 9
const DOWN = 13
const UP = 12
const RIGHT = 15

/** A fake standard pad behind navigator.getGamepads, which the game polls every frame. */
function stubPad() {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
  const pad = {
    id: 'Test pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons,
    timestamp: 0,
  }
  Object.assign(window, { __pad: pad })
  Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null] })
}

type Pad = { axes: number[]; buttons: { pressed: boolean; value: number }[] }
const pad = (page: Page) => ({
  button: (i: number, v: number) =>
    page.evaluate(
      ([b, value]) => {
        const p = (window as unknown as { __pad: Pad }).__pad
        Object.assign(p.buttons[b], { pressed: value > 0.5, value })
      },
      [i, v],
    ),
  axis: (i: number, v: number) =>
    page.evaluate(
      ([a, value]) => {
        ;(window as unknown as { __pad: Pad }).__pad.axes[a] = value
      },
      [i, v],
    ),
})

/** Press and release across a couple of rendered frames, so a poll sees both edges. */
async function press(page: Page, b: number, frames = 2) {
  await pad(page).button(b, 1)
  await settle(page, frames)
  await pad(page).button(b, 0)
  await settle(page, 1)
}

test('gamepad: menus, walking, jumping, a car, throttle, and pause', async ({ page }) => {
  test.setTimeout(300_000 * SLOW)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(stubPad)
  await page.goto('/?quality=low')
  const p = pad(page)
  // The D-pad walks the title menu; A on Play starts the game.
  await expect(page.getByRole('button', { name: 'Play' })).toBeFocused()
  await p.button(DOWN, 1)
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused()
  await p.button(DOWN, 0)
  await p.button(UP, 1)
  await expect(page.getByRole('button', { name: 'Play' })).toBeFocused()
  await p.button(UP, 0)
  await p.button(A, 1)
  await page.waitForFunction(() => '__game' in window, null, { timeout: LOAD_TIMEOUT })
  await p.button(A, 0)
  await settle(page)
  expect((await game(page)).device).toBe('pad')

  const before = await game(page)
  await p.axis(1, -1)
  await settle(page, 6)
  await p.axis(1, 0)
  const walked = await game(page)
  const moved = Math.hypot(
    walked.position.x - before.position.x,
    walked.position.z - before.position.z,
  )
  console.log(`pad walk moved ${moved.toFixed(2)} m`)
  expect(moved).toBeGreaterThan(0.3)

  await settle(page, 4)
  const ground = (await game(page)).position.y
  await p.button(A, 1)
  await page.waitForFunction(
    (y) =>
      (window as unknown as { __game: { state: () => { position: { y: number } } } }).__game.state()
        .position.y >
      y + 0.2,
    ground,
    { timeout: LOAD_TIMEOUT },
  )
  await p.button(A, 0)

  await visit(page, 'car', 0.6, 0.2)
  await expect(page.locator('#prompt kbd')).toHaveText('Y')
  await press(page, Y)
  expect((await game(page)).mode).toBe('driving')
  await p.button(RT, 1)
  await settle(page, 12)
  const driving = await game(page)
  await p.button(RT, 0)
  console.log(`pad driving at ${driving.speed.toFixed(2)} m/s`)
  expect(driving.speed).toBeGreaterThan(0)

  await press(page, START)
  expect((await game(page)).paused).toBe(true)
  // Up from Resume reaches the tabs; right three times is Controls.
  await press(page, UP, 1)
  for (let i = 0; i < 3; i++) await press(page, RIGHT, 1)
  await expect(page.getByRole('tab', { name: 'Controls' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#keys-title')).toHaveText('Gamepad')
  await press(page, START)
  expect((await game(page)).paused).toBe(false)
  expect(errors).toEqual([])
})
