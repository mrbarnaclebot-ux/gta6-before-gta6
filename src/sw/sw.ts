import { CACHE, keyFor, MANIFEST, staleKeys, type Manifest } from './cache-plan'

/*
 * The service worker (production builds only, built to /sw.js): answers asset requests from
 * Cache Storage so a repeat visit downloads nothing that has not changed. The page itself and
 * anything the manifest does not list always go to the network.
 */

// The DOM lib has no service worker types; these are the few members used.
interface FetchEvent extends Event {
  request: Request
  respondWith(r: Promise<Response>): void
  waitUntil(p: Promise<unknown>): void
}
type Scope = typeof globalThis & {
  skipWaiting(): Promise<void>
  clients: { claim(): Promise<void> }
  location: Location
}
const sw = self as unknown as Scope

let manifest: Promise<Manifest | null> = loadManifest()

async function loadManifest(): Promise<Manifest | null> {
  try {
    const res = await fetch(MANIFEST, { cache: 'no-cache' })
    return res.ok ? ((await res.json()) as Manifest) : null
  } catch {
    return null
  }
}

/** Drops every cached file the current manifest no longer lists. */
async function prune(m: Manifest | null): Promise<void> {
  if (!m) return
  const cache = await caches.open(CACHE)
  const keys = (await cache.keys()).map((r) => r.url)
  await Promise.all(staleKeys(keys, m, sw.location.origin).map((k) => cache.delete(k)))
}

async function answer(req: Request, key: string): Promise<Response> {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(key)
  if (hit) return hit
  const res = await fetch(req)
  // A full quota only costs the next visit a download.
  if (res.status === 200) await cache.put(key, res.clone()).catch(() => {})
  return res
}

sw.addEventListener('install', () => void sw.skipWaiting())
sw.addEventListener('activate', (e) => {
  ;(e as FetchEvent).waitUntil(sw.clients.claim().then(() => manifest.then(prune)))
})

sw.addEventListener('fetch', (event) => {
  const e = event as FetchEvent
  const req = e.request
  // Each page load re-reads the manifest, so a deploy is picked up on the next visit.
  if (req.mode === 'navigate') {
    manifest = loadManifest()
    e.waitUntil(manifest.then(prune))
    return
  }
  const range = req.headers.get('range')
  if (!/^\/(assets|build)\//.test(new URL(req.url).pathname)) return
  e.respondWith(
    manifest.then((m) => {
      const key = keyFor(m, { method: req.method, url: req.url, range }, sw.location.origin)
      return key ? answer(req, key) : fetch(req)
    }),
  )
})
