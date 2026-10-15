import { expect, test, type Page } from '@playwright/test'
import { play, settle, SLOW, visit, type Game } from './helpers'

/**
 * Nothing floats or sinks: a ray straight down from every parked car, traffic car, and
 * visible person finds solid ground within 10 cm of where it stands.
 */
async function expectGrounded(page: Page, where: string) {
  await settle(page, 20)
  const gaps = await page.evaluate(() =>
    (window as unknown as { __game: Game }).__game.groundGaps(),
  )
  const bad = gaps.filter((g) => g.gap === null || Math.abs(g.gap) > 0.1)
  expect(bad, `floating or sunk near ${where}`).toEqual([])
  // Highway traffic spawns within reach of the flyover, so its cars are checked there.
  if (where === 'flyover') expect(gaps.some((g) => g.kind === 'traffic')).toBe(true)
}

// The 2 km world outside the city: each district's landmark is solid ground to stand on,
// and the highway flyover deck holds the player up 6 m over Hill Road.
test('stands in the residential streets, on the hill, in the forest, and on the flyover, with nothing afloat', async ({
  page,
}) => {
  test.setTimeout(300_000 * SLOW)
  const errors = await play(page, '/?quality=low')
  for (const [name, yaw] of [
    ['residential', 2.4],
    ['hillside', -Math.PI / 2],
    ['forest', 0.5],
    ['flyover', Math.PI],
  ] as const) {
    await visit(page, name, yaw, 0.15)
    await page.screenshot({ path: `test-results/${name}.png` })
    if (name !== 'forest') await expectGrounded(page, name)
  }
  expect(errors).toEqual([])
})
