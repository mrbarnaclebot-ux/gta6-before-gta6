import { expect, test, type Page } from '@playwright/test'

type Point = { x: number; y: number; z: number }
type GameState = {
  position: Point
  frames: number
  mode: string
  fps: number
  drawCalls: number
  breath: number
  underwater: boolean
  speed: number
}
type Game = {
  state: () => GameState
  landmarks: () => Record<string, Point>
  teleport: (x: number, y: number, z: number) => void
  setCameraYaw: (yaw: number) => void
  setCameraPitch: (pitch: number) => void
}

const game = (page: Page) =>
  page.evaluate(() => (window as unknown as { __game: Game }).__game.state())

/** Waits for a few rendered frames: SwiftShader runs at a few fps, so wall-clock waits are unreliable. */
async function settle(page: Page, frames = 6) {
  const start = (await game(page)).frames
  await page.waitForFunction(
    (n) => (window as unknown as { __game: Game }).__game.state().frames > n,
    start + frames,
    { timeout: 60_000 },
  )
}

/** Teleports to a named landmark, aims the camera, and checks the player stands on solid ground there. */
async function visit(page: Page, name: string, yaw: number, pitch: number) {
  const spot = await page.evaluate(
    ([n, yw, p]) => {
      const g = (window as unknown as { __game: Game }).__game
      const at = g.landmarks()[n as string]
      g.teleport(at.x, at.y + 0.3, at.z)
      g.setCameraYaw(yw as number)
      g.setCameraPitch(p as number)
      return at
    },
    [name, yaw, pitch] as const,
  )
  await settle(page)
  const s = await game(page)
  console.log(
    `${name}: y ${s.position.y.toFixed(2)} (ground ${spot.y.toFixed(2)}), ${s.drawCalls} draw calls`,
  )
  expect(Math.abs(s.position.y - spot.y)).toBeLessThan(0.5)
}

test('loads, plays, walks, and stands on the city', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible()
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => '__game' in window, null, { timeout: 60_000 })
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
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => '__game' in window, null, { timeout: 60_000 })
  await settle(page)

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

test('gets into a parked car and drives it', async ({ page }) => {
  // SwiftShader draws a dozen detailed cars at well under 1 fps; Low skips post-processing.
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?quality=low')
  // Space on the focused Play button must start the game, not be swallowed as a game key.
  await page.getByRole('button', { name: 'Play' }).press('Space')
  await page.waitForFunction(() => '__game' in window, null, { timeout: 60_000 })
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
