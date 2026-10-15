import { expect, test } from '@playwright/test'
import { play, SLOW, visit } from './helpers'

// The 2 km world outside the city: each district's landmark is solid ground to stand on,
// and the highway flyover deck holds the player up 6 m over Hill Road.
test('stands in the residential streets, on the hill, in the forest, and on the flyover', async ({
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
  }
  expect(errors).toEqual([])
})
