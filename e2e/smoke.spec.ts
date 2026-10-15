import { expect, test, type Page } from '@playwright/test'

type Point = { x: number; y: number; z: number }
type GameState = { position: Point; frames: number; mode: string; fps: number; drawCalls: number }
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
