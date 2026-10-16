import { expect, type Page } from '@playwright/test'

export type Point = { x: number; y: number; z: number }
export type GameState = {
  position: Point
  frames: number
  mode: string
  vehicle: 'car' | 'boat' | null
  carjack: 'walk' | 'pull' | null
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
  mapOpen: boolean
  sensitivity: number
  hours: number
  night: number
  quality: string
}
export type Game = {
  state: () => GameState
  landmarks: () => Record<string, Point>
  teleport: (x: number, y: number, z: number) => void
  setCameraYaw: (yaw: number) => void
  setCameraPitch: (pitch: number) => void
  dummies: () => (Point & { health: number })[]
  aimAt: (x: number, y: number, z: number) => void
  peds: () => (Point & { health: number; state: string })[]
  traffic: () => (Point & { id: number; speed: number; heading: number })[]
  hospitals: () => (Point & { name: string })[]
  hurt: (amount: number) => void
  skipDeath: () => void
  setTime: (hours: number) => void
  waypoint: () => (Point & { route: { x: number; z: number }[] }) | null
  waterAt: (x: number, z: number) => number | null
  ground: (x: number, z: number) => number
  sea: () => { reefs: Point[]; schools: number; fish: Point[] }
  groundGaps: () => { kind: string; x: number; y: number; z: number; gap: number | null }[]
}

/** SwiftShader on a 2-core CI runner is a few times slower than on a dev machine. */
export const SLOW = process.env.CI ? 3 : 1
/**
 * Loading the city and the first frames at a new spot (shader compiles) run on the CPU under
 * SwiftShader; with five tests rendering in parallel either can take over a minute.
 */
export const LOAD_TIMEOUT = 120_000 * SLOW

export const game = (page: Page) =>
  page.evaluate(() => (window as unknown as { __game: Game }).__game.state())

/** Waits for a few rendered frames: SwiftShader runs at a few fps, so wall-clock waits are unreliable. */
export async function settle(page: Page, frames = 6) {
  const start = (await game(page)).frames
  await page.waitForFunction(
    (n) => (window as unknown as { __game: Game }).__game.state().frames > n,
    start + frames,
    { timeout: LOAD_TIMEOUT },
  )
}

/** Opens `url`, presses Play, and waits for the game. Returns the page errors seen from then on. */
export async function play(page: Page, url: string) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(url)
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => '__game' in window, null, { timeout: LOAD_TIMEOUT })
  await settle(page)
  return errors
}

/**
 * Teleports to a named landmark, aims the camera, and checks the player is within `slack`
 * meters of it: on solid ground, or afloat (the swell lifts and drops a swimmer, so pass more).
 */
export async function visit(page: Page, name: string, yaw: number, pitch: number, slack = 0.5) {
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
  expect(Math.abs(s.position.y - spot.y)).toBeLessThan(slack)
}
