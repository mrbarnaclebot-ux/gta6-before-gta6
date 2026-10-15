import { expect, test } from '@playwright/test'
import { game, play, settle } from './helpers'

// GitHub's 2-core runners draw the full scenes in SwiftShader too slowly for the
// other specs, so CI only proves the build boots, renders, and the player walks.
test('boots on Low, plays, and walks', { tag: '@smoke' }, async ({ page }) => {
  test.setTimeout(480_000)
  const errors = await play(page, '/?quality=low')
  await expect(page.locator('#title')).toBeHidden()
  const before = await game(page)
  expect(before.mode).toBe('walking')
  await page.keyboard.down('w')
  await settle(page, 4)
  await page.keyboard.up('w')
  const after = await game(page)
  const moved = Math.hypot(
    after.position.x - before.position.x,
    after.position.z - before.position.z,
  )
  console.log(`moved ${moved.toFixed(2)} m at ${after.fps} fps`)
  expect(moved).toBeGreaterThan(0.1)
  expect(errors).toEqual([])
})
