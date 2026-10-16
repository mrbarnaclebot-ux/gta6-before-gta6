// Trailer footage: node scripts/trailer.mjs <url> <out-dir> <shots.json> [shot names...]
// Writes <out-dir>/<shot>/0001.jpg... at 30 fps of game time. Playwright's fake clock steps the
// game 1/30 s per frame, so capture speed does not matter. macOS only (Metal GPU, as perf.mjs).
// See trailer-shots.json for the shot format and trailer-page.mjs for the cameras and setups.
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { timedLoad } from './perf-lib.mjs'
import { installTrailer } from './trailer-page.mjs'

const FPS = 30
const [URL, OUT, LIST, ...only] = process.argv.slice(2)
const shots = JSON.parse(readFileSync(LIST, 'utf8')).filter(
  (s) => !only.length || only.includes(s.name),
)
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'],
})
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  serviceWorkers: 'block',
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('pageerror', e.message))
await timedLoad(ctx, page, `${URL}?quality=ultra`)
await page.addStyleTag({ content: 'body > :not(#view) { display: none !important }' })
await page.evaluate(installTrailer)
await page.clock.install()
await page.clock.pauseAt(Date.now() + 2000)

/** Run game time forward `ms`, letting fetches and workers land in real time between steps. */
async function warm(ms) {
  for (let t = 0; t < ms; t += 250) {
    await page.clock.runFor(250)
    await page.waitForTimeout(120)
  }
}

for (const shot of shots) {
  const dir = `${OUT}/${shot.name}`
  mkdirSync(dir, { recursive: true })
  const t0 = Date.now()
  await page.evaluate((s) => window.__trailer.setup(s), shot)
  // Setups that wait on the game (getting into a car, a traffic car stopping) poll here.
  for (let i = 0; i < 240 && !(await page.evaluate(() => window.__trailer.ready())); i++)
    await warm(250)
  await warm((shot.warm ?? 6) * 1000)
  await page.evaluate((s) => window.__trailer.start(s), shot)
  // `lead` seconds run before the first saved frame (a car getting up to speed);
  // STRIDE=n saves every nth frame only, for a quick look at a shot.
  const lead = Math.round((shot.lead ?? 0) * FPS)
  const frames = Math.round(shot.secs * FPS)
  const stride = +(process.env.STRIDE || 1)
  for (let i = -lead; i < frames; i++) {
    await page.evaluate((t) => window.__trailer.step(t), i / FPS)
    // 33 or 34 ms, so whole milliseconds still add up to exactly 30 fps.
    await page.clock.runFor(Math.round(((i + 1) * 1000) / FPS) - Math.round((i * 1000) / FPS))
    if (i < 0 || i % stride) continue
    await page.screenshot({ path: `${dir}/${String(i + 1).padStart(4, '0')}.jpg`, quality: 92 })
  }
  await page.evaluate(() => window.__trailer.end())
  // Out of any vehicle before the next setup teleports the player.
  for (
    let i = 0;
    i < 40 && (await page.evaluate(() => window.__game.state().mode)) !== 'walking';
    i++
  )
    await warm(250)
  console.log(`${shot.name}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
}
await browser.close()
