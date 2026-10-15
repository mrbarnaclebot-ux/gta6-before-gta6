// Frame-rate and load probe: node scripts/perf.mjs <url> <screenshot-dir> [high|low] [deviceScaleFactor]
// macOS only: it forces Chrome onto the real GPU through ANGLE's Metal backend.
// UNCAPPED=1 turns off vsync so A/B runs show headroom above 60 fps.
import { chromium } from '@playwright/test'
const URL = process.argv[2]
const OUT = process.argv[3]
const quality = process.argv[4] || 'high'
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=metal',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-webgpu',
    ...(process.env.UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []),
  ],
})
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: +(process.argv[5] || 1),
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const cdp = await ctx.newCDPSession(page)
await cdp.send('Network.enable')
let bytes = 0
cdp.on('Network.loadingFinished', (e) => {
  bytes += e.encodedDataLength
})
const t0 = Date.now()
await page.goto(`${URL}?quality=${quality}&debug`, { waitUntil: 'load' })
const tTitle = Date.now() - t0
const gpu = await page.evaluate(() => {
  const g = document.createElement('canvas').getContext('webgl2')
  const e = g.getExtension('WEBGL_debug_renderer_info')
  return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'
})
const t1 = Date.now()
await page.getByRole('button', { name: 'Play' }).click()
await page.waitForFunction(() => window.__game && window.__game.state().frames > 3, null, {
  timeout: 120000,
})
const tPlay = Date.now() - t1
await page.waitForTimeout(4000)
const bytesAfterPlay = bytes
const g = (fn, arg) => page.evaluate(fn, arg)
async function sample(label, secs = 5) {
  // A teleport costs a hitch (new textures and shadow maps), and dynamic resolution
  // (on in Medium) takes a couple of seconds to settle after it: measure the steady state.
  await page.waitForTimeout(4000)
  const f0 = await g(() => [window.__game.state().frames, performance.now()])
  await page.waitForTimeout(secs * 1000)
  const f1 = await g(() => [
    window.__game.state().frames,
    performance.now(),
    window.__game.state().drawCalls,
  ])
  const fps = ((f1[0] - f0[0]) * 1000) / (f1[1] - f0[1])
  await page.screenshot({ path: `${OUT}/${quality}-dsf${process.argv[5] || 1}-${label}.png` })
  return { label, fps: +fps.toFixed(1), drawCalls: f1[2] }
}
const res = []
res.push(await sample('spawn'))
// Yaw 0 looks north (-z), pi/2 west toward the city from the beach, -pi/2 east.
for (const [name, yaw] of [
  ['downtown', 0],
  ['beach', Math.PI / 2],
  ['canal', 0],
  ['hillside', -Math.PI / 2],
  ['flyover', Math.PI],
  ['residential', 2.4],
]) {
  await g(
    ([n, y]) => {
      const G = window.__game
      const a = G.landmarks()[n]
      G.teleport(a.x, a.y + 0.3, a.z)
      G.setCameraYaw(y)
      G.setCameraPitch(0.15)
    },
    [name, yaw],
  )
  res.push(await sample(name))
}
await g(() => {
  const G = window.__game
  const a = G.landmarks().downtown
  G.teleport(a.x, a.y + 0.3, a.z)
  G.setTime(21.5)
})
res.push(await sample('downtown-night'))
console.log(
  JSON.stringify(
    {
      quality,
      gpu,
      titleLoadMs: tTitle,
      playToFirstFramesMs: tPlay,
      transferredMB: +(bytesAfterPlay / 1e6).toFixed(1),
      samples: res,
      errors,
    },
    null,
    1,
  ),
)
await browser.close()
