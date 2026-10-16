// Page-side probes for perf.mjs: a frame-time recorder, the drive across the map, and load timing.

/** Installs a rAF recorder in the page: window.__ft.on starts collecting frame times in ms. */
export const installRecorder = (page) =>
  page.evaluate(() => {
    if (window.__ft) return
    const f = (window.__ft = { on: false, t: [], last: 0 })
    const tick = (now) => {
      if (f.on && f.last) f.t.push(now - f.last)
      f.last = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

export const startFrames = (page) =>
  page.evaluate(() => {
    Object.assign(window.__ft, { on: true, t: [], last: 0, cpu0: window.__game.state().cpu })
  })

/** Stops the recorder and returns avg fps, p95 and p99 frame time, and frames over 50 and 100 ms. */
export async function stopFrames(page) {
  const [t, cpu] = await page.evaluate(() => {
    const f = window.__ft
    const c = window.__game.state().cpu
    f.on = false
    return [f.t, (c.ms - f.cpu0.ms) / Math.max(1, c.frames - f.cpu0.frames)]
  })
  // cpuMs: main-thread work per frame; the rest of a frame is GPU time or waiting on it.
  return { ...frameStats(t), cpuMs: +cpu.toFixed(2) }
}

export function frameStats(t) {
  if (!t.length) return { frames: 0 }
  const sorted = [...t].sort((a, b) => a - b)
  const pct = (p) => +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(1)
  const sum = t.reduce((a, b) => a + b, 0)
  return {
    frames: t.length,
    fps: +((t.length * 1000) / sum).toFixed(1),
    p95: pct(0.95),
    p99: pct(0.99),
    max: +sorted[sorted.length - 1].toFixed(1),
    over50: t.filter((x) => x > 50).length,
    over100: t.filter((x) => x > 100).length,
  }
}

/**
 * Moves the player along a road at `speed` m/s, camera looking ahead, until the road ends.
 * ponytail: the player is teleported each frame rather than driven, so it measures streaming
 * and rendering at speed, not car physics.
 */
export const drive = (page, pts, speed) =>
  page.evaluate(
    ([pts, speed]) =>
      new Promise((done) => {
        const G = window.__game
        const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.z - pts[i].z))
        let i = 0
        let s = 0
        let last = 0
        const step = (now) => {
          s += last ? (speed * Math.min(now - last, 100)) / 1000 : 0
          last = now
          while (i < seg.length && s > seg[i]) s -= seg[i++]
          if (i >= seg.length) return done()
          const a = pts[i]
          const b = pts[i + 1]
          const k = s / seg[i]
          G.teleport(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + 0.4, a.z + (b.z - a.z) * k)
          G.setCameraYaw(Math.atan2(-(b.x - a.x), -(b.z - a.z)))
          G.setCameraPitch(0.12)
          requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
    [pts, speed],
  )

/** Counts requests in flight and bytes received over a CDP session. */
export async function netMeter(ctx, page) {
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  const m = { bytes: 0, inflight: new Set(), lastActivity: Date.now(), fromCache: 0, requests: 0 }
  cdp.on('Network.requestWillBeSent', (e) => {
    m.inflight.add(e.requestId)
    m.requests++
    m.lastActivity = Date.now()
  })
  cdp.on('Network.requestServedFromCache', () => m.fromCache++)
  const end = (e) => {
    m.inflight.delete(e.requestId)
    m.lastActivity = Date.now()
  }
  cdp.on('Network.loadingFinished', (e) => {
    m.bytes += e.encodedDataLength
    end(e)
  })
  cdp.on('Network.loadingFailed', end)
  return m
}

/** Waits until nothing has been in flight for `quiet` ms and the game says streaming is done. */
export async function waitStreamed(page, m, quiet = 1500, timeout = 120000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const done = await page.evaluate(() => window.__game?.state().streamed !== false)
    if (done && !m.inflight.size && Date.now() - m.lastActivity > quiet) return
    await page.waitForTimeout(100)
  }
}

/** Opens the page, presses Play, and times the title, the first frame, and the end of streaming. */
export async function timedLoad(ctx, page, url) {
  const m = await netMeter(ctx, page)
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => {
    const logo = document.querySelector('.wordmark img')
    return document.getElementById('play')?.checkVisibility() && (!logo || logo.complete)
  })
  const title = Date.now() - t0
  // Like a person who reads the menu for a moment: the engine prefetch starts on load.
  await page.waitForTimeout(+(process.env.MENU_MS || 1500))
  const t1 = Date.now()
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => window.__game && window.__game.state().frames > 3, null, {
    timeout: 180000,
  })
  const firstFrame = Date.now() - t1
  await waitStreamed(page, m)
  const streamed = Date.now() - t1 - 1500
  return {
    titleMs: title,
    playToFrameMs: firstFrame,
    playToStreamedMs: Math.max(firstFrame, streamed),
    transferredMB: +(m.bytes / 1e6).toFixed(1),
    requests: m.requests,
  }
}

/** JS heap and three.js memory counters. */
export const memory = (page) =>
  page.evaluate(() => {
    const s = window.__game.state()
    const heap = performance.memory?.usedJSHeapSize ?? 0
    return { heapMB: +(heap / 1e6).toFixed(0), geometries: s.geometries, textures: s.textures }
  })
