import { expect, test, type Page } from '@playwright/test'
import { LOAD_TIMEOUT, settle, SLOW } from './helpers'

type AudioState = { context: string; prefs: Record<string, number | boolean> }

/** Bytes of sound files the page has fetched so far. */
const audioBytes = (page: Page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/assets/audio/'))
      .reduce((sum, e) => sum + (e as PerformanceResourceTiming).encodedBodySize, 0),
  )

/** Opens Settings on the title screen at the Audio tab. */
async function audioTab(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('tab', { name: 'Audio' }).click()
  await expect(page.locator('#tab-audio')).toBeVisible()
}

test('audio: settings persist, and Play starts the sound', async ({ page }) => {
  test.setTimeout(180_000 * SLOW)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?quality=low')

  // A range input cannot be typed into; set it and fire the input event like a drag does.
  await audioTab(page)
  await page.locator('#music').evaluate((el: HTMLInputElement) => {
    el.value = '0.4'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.locator('#tab-audio output[for="music"]')).toHaveText('40%')
  await page.getByRole('button', { name: 'Back' }).click()

  await page.reload()
  await page.waitForLoadState('networkidle')
  const before = await audioBytes(page)
  console.log(`audio fetched before Play: ${(before / 1024).toFixed(0)} KB`)
  expect(before).toBeLessThan(1.5 * 1024 * 1024)
  await audioTab(page)
  await expect(page.locator('#music')).toHaveValue('0.4')
  await page.getByRole('button', { name: 'Back' }).click()

  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => '__game' in window, null, { timeout: LOAD_TIMEOUT })
  await settle(page)
  const audio = await page.evaluate(() =>
    (window as unknown as { __game: { audio: () => AudioState } }).__game.audio(),
  )
  console.log(`audio context ${audio.context}`)
  expect(audio.context).toBe('running')
  expect(audio.prefs.music).toBe(0.4)
  expect(errors).toEqual([])
})
