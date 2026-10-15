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
  ammo: number
  aiming: boolean
  health: number
  dead: boolean
  wanted: number
  paused: boolean
  sensitivity: number
  hours: number
  night: number
}
type Game = {
  state: () => GameState
  landmarks: () => Record<string, Point>
  teleport: (x: number, y: number, z: number) => void
  setCameraYaw: (yaw: number) => void
  setCameraPitch: (pitch: number) => void
  dummies: () => (Point & { health: number })[]
  aimAt: (x: number, y: number, z: number) => void
  peds: () => (Point & { health: number; state: string })[]
  traffic: () => (Point & { speed: number })[]
  hospitals: () => (Point & { name: string })[]
  hurt: (amount: number) => void
  skipDeath: () => void
  setTime: (hours: number) => void
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
  // High quality in SwiftShader with people and traffic about runs near 1 fps.
  test.setTimeout(180_000)
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
  test.setTimeout(180_000)
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

test('aims and shoots a target dummy', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?quality=low')
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => '__game' in window, null, { timeout: 60_000 })
  await settle(page)

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

test('people, traffic, wanted level, death, pause menu, and night', async ({ page }) => {
  test.setTimeout(300_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?quality=low')
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => '__game' in window, null, { timeout: 60_000 })
  await settle(page)
  await expect(page.locator('#minimap')).toBeVisible()
  const hook = <T>(fn: (g: Game) => T) =>
    page.evaluate(`(${fn.toString()})(window.__game)`) as Promise<T>

  // People walk the sidewalks and traffic drives the lanes.
  expect((await hook((g) => g.peds())).length).toBeGreaterThan(5)
  const before = await hook((g) => g.traffic())
  expect(before.length).toBeGreaterThan(3)
  await settle(page, 4)
  const after = await hook((g) => g.traffic())
  const moved = after.some((c, i) => Math.hypot(c.x - before[i].x, c.z - before[i].z) > 0.3)
  expect(moved).toBe(true)

  // Shooting a passer-by earns a star and sends people running.
  await hook((g) => {
    const s = g.state().position
    const d = (p: Point) => Math.hypot(p.x - s.x, p.z - s.z)
    const ped = g.peds().sort((a, b) => d(a) - d(b))[0]
    g.teleport(ped.x + 4, ped.y - 1, ped.z + 4)
  })
  await settle(page, 2)
  await hook((g) => {
    const s = g.state().position
    const d = (p: Point) => Math.hypot(p.x - s.x, p.z - s.z)
    const ped = g.peds().sort((a, b) => d(a) - d(b))[0]
    g.aimAt(ped.x, ped.y, ped.z)
  })
  await page.mouse.move(640, 360)
  await page.mouse.down()
  await page.mouse.up()
  await settle(page, 3)
  expect((await game(page)).wanted).toBeGreaterThan(0)
  await expect(page.locator('#wanted')).toBeVisible()
  const states = (await hook((g) => g.peds())).map((p) => p.state)
  console.log(`wanted ${(await game(page)).wanted}, people: ${states.join(' ')}`)
  expect(states.some((s) => s === 'flee' || s === 'dead')).toBe(true)

  // Dying shows the death screen, then the player wakes up at the nearest hospital.
  await hook((g) => g.hurt(1000))
  await settle(page, 2)
  expect((await game(page)).dead).toBe(true)
  await expect(page.locator('#death')).toBeVisible()
  await hook((g) => g.skipDeath())
  await settle(page, 3)
  const revived = await game(page)
  expect(revived.dead).toBe(false)
  expect(revived.health).toBe(100)
  expect(revived.wanted).toBe(0)
  const hospitals = await hook((g) => g.hospitals())
  const p = revived.position
  const gap = Math.min(...hospitals.map((h) => Math.hypot(h.x - p.x, h.z - p.z)))
  expect(gap).toBeLessThan(2)

  // Esc pauses: the clock stops, and the sensitivity setting persists.
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

  // Night: street lights and neon come on.
  await hook((g) => g.setTime(22))
  await settle(page, 3)
  expect((await game(page)).night).toBeGreaterThan(0.9)
  await page.screenshot({ path: 'test-results/night.png' })
  expect(errors).toEqual([])
})
