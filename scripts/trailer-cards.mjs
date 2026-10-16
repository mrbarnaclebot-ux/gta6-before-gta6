// Trailer graphics: node scripts/trailer-cards.mjs <out-dir>
// Screenshots each card in trailer-cards.html to a 1920x1080 PNG (transparent except the rating card).
import { chromium } from '@playwright/test'

const OUT = process.argv[2]
const CARDS = ['rating', 'presents', 'chyron', 'social', 'logo', 'endtext']
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
for (const card of CARDS) {
  await page.goto(new URL(`trailer-cards.html?card=${card}`, import.meta.url).href)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/${card}.png`, omitBackground: true })
}
await browser.close()
