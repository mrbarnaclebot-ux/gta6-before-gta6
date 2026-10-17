// Load-time and frame-time probe: node scripts/perf.mjs <url> <screenshot-dir> [quality] [deviceScaleFactor]
// macOS only: it forces Chrome onto the real GPU through ANGLE's Metal backend.
// UNCAPPED=1 turns off vsync so A/B runs show headroom above 60 fps. ONLY=forest,beach,drive samples
// just those. VIEWPORT=844x390 sets the window (phone sizes get touch). NOWARM=1 skips the second (warm cache) visit. EXTRA=&foo appends to the query string.
import { chromium } from '@playwright/test'
import { drive, installRecorder, memory, startFrames, stopFrames, timedLoad } from './perf-lib.mjs'

const URL = process.argv[2]
const OUT = process.argv[3]
const quality = process.argv[4] || 'high'
const dsf = +(process.argv[5] || 1)
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=metal',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-precise-memory-info',
    ...(process.env.UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []),
  ],
})
// VIEWPORT=844x390 measures a phone-sized window with touch and mobile emulation.
const [vw, vh] = (process.env.VIEWPORT || '1920x1080').split('x').map(Number)
const phone = !!process.env.VIEWPORT
const view = {
  viewport: { width: vw, height: vh },
  deviceScaleFactor: dsf,
  hasTouch: phone,
  isMobile: phone,
}
// The service worker's own fetches never reach the page's network log, so the first visit
// (cold bytes, timings, every scene) runs with it blocked; the warm visit gets its own profile.
const ctx = await browser.newContext({ ...view, serviceWorkers: 'block' })
const full = `${URL}?quality=${quality}&debug${process.env.EXTRA || ''}`
let page = await ctx.newPage()
const errors = []
const watch = (p) => p.on('pageerror', (e) => errors.push(e.message))
watch(page)
const cold = await timedLoad(ctx, page, full)
const coldMemory = await memory(page)
const g = (fn, arg) => page.evaluate(fn, arg)
const gpu = await g(() => {
  const c = document.createElement('canvas').getContext('webgl2')
  const e = c.getExtension('WEBGL_debug_renderer_info')
  return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'
})
await installRecorder(page)

async function sample(label, secs = 5) {
  // A teleport costs a hitch (new textures and shadow maps), and dynamic resolution
  // (on in Medium) takes a couple of seconds to settle after it: measure the steady state.
  await page.waitForTimeout(4000)
  await startFrames(page)
  await page.waitForTimeout(secs * 1000)
  const stats = await stopFrames(page)
  const drawCalls = await g(() => window.__game.state().drawCalls)
  await page.screenshot({ path: `${OUT}/${quality}-dsf${dsf}-${label}.png` })
  return { label, ...stats, drawCalls }
}

const only = process.env.ONLY?.split(',')
const wanted = (name) => !only || only.includes(name)
const res = []
if (wanted('spawn')) res.push(await sample('spawn'))
// Yaw 0 looks north (-z), pi/2 west toward the city from the beach, -pi/2 east.
for (const [name, yaw, at] of [
  ['downtown', 0],
  ['beach', Math.PI / 2],
  // From the beach out over the surf and foam.
  ['shore', -Math.PI / 2, 'beach'],
  ['canal', 0],
  // From the marina's T-head back along the pier, the moored boats, and the city beyond.
  ['marina', Math.PI / 2],
  ['hillside', -Math.PI / 2],
  ['flyover', Math.PI],
  ['residential', 2.4],
  ['forest', 0.5],
  // The forest from the Hillside lookout, looking west over the woods.
  ['forest-hill', 1.2, 'hillside'],
  // The island's coasts and waters: cliff top over the north sea, the west beach out to sea,
  // the river mouth's bank looking out of the estuary, the lake from its jetty, and the
  // north canal mouth from its quay, out between the breakwaters.
  ['northCoast', 0],
  ['westBeach', Math.PI / 2],
  ['riverMouth', Math.PI],
  ['lake', Math.PI / 2],
  ['canalMouth', 0],
]) {
  if (!wanted(name)) continue
  await g(
    ([n, y, at]) => {
      const G = window.__game
      const a = G.landmarks()[at || n]
      G.teleport(a.x, a.y + 0.3, a.z)
      G.setCameraYaw(y)
      G.setCameraPitch(0.15)
    },
    [name, yaw, at],
  )
  res.push(await sample(name))
}
if (wanted('underwater')) {
  // On the reef nearest the beach, held down with the dive key while sampling.
  await g(() => {
    const G = window.__game
    const b = G.landmarks().beach
    const r = G.sea().reefs.reduce((a, c) => (Math.abs(c.z - b.z) < Math.abs(a.z - b.z) ? c : a))
    G.teleport(r.x - 6, r.y + 1.5, r.z)
    G.setCameraYaw(-Math.PI / 2)
    G.setCameraPitch(0.05)
  })
  await page.keyboard.down('KeyC')
  res.push(await sample('underwater'))
  await page.keyboard.up('KeyC')
}
if (wanted('downtown-night')) {
  await g(() => {
    const G = window.__game
    const a = G.landmarks().downtown
    G.teleport(a.x, a.y + 0.3, a.z)
    G.setTime(21.5)
  })
  res.push(await sample('downtown-night'))
  await g(() => window.__game.setTime(10))
}

let driveStats = null
if (wanted('drive')) {
  // The whole highway loop at 40 m/s (144 km/h): city, residential, hills, forest edge, coast.
  const pts = await g(() => window.__game.lane('highway', 4.9))
  await g((p) => window.__game.teleport(p.x, p.y + 0.4, p.z), pts[0])
  await page.waitForTimeout(3000)
  await startFrames(page)
  const t0 = Date.now()
  await drive(page, pts, +(process.env.SPEED || 40))
  driveStats = { seconds: Math.round((Date.now() - t0) / 1000), ...(await stopFrames(page)) }
  await page.screenshot({ path: `${OUT}/${quality}-dsf${dsf}-drive-end.png` })
}
const afterMemory = await memory(page)

let warm = null
if (!process.env.NOWARM) {
  // A second visit in the same browser profile: HTTP cache and any service worker are warm.
  await page.close()
  const ctx2 = await browser.newContext({
    ...view,
    serviceWorkers: process.env.BLOCKSW ? 'block' : 'allow',
  })
  const first = await ctx2.newPage()
  await timedLoad(ctx2, first, full)
  await first.close()
  page = await ctx2.newPage()
  watch(page)
  warm = await timedLoad(ctx2, page, full)
}
const out = { quality, dsf, gpu, cold, warm, coldMemory, afterMemory, samples: res }
console.log(JSON.stringify({ ...out, drive: driveStats, errors }, null, 1))
await browser.close()
