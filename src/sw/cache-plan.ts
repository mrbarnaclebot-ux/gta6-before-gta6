/*
 * Which requests the service worker answers from Cache Storage, and under which key. The
 * build writes asset-manifest.json: every file's path and a hash of its bytes. A cached copy
 * is keyed by path plus hash, so a deploy that changes a file misses the old copy, and
 * entries whose key is not in the current manifest are deleted.
 */

export const CACHE = 'gta6-files-v1'
export const MANIFEST = '/asset-manifest.json'

export interface Manifest {
  /** Hash over every file: changes whenever any file does. */
  build: string
  /** Path (from the site root, with a leading slash) to a hash of the file's bytes. */
  files: Record<string, string>
}

/** The cache key for one version of a file. */
export const cacheKey = (path: string, hash: string) => `${path}?v=${hash}`

/**
 * The key to answer a request with, or null to leave it to the network: only same-origin
 * GETs for files the manifest knows, and never range requests (audio streams ask for parts
 * of a file, and a 206 must not be cached as the whole).
 */
export function keyFor(
  m: Manifest | null,
  req: { method: string; url: string; range: string | null },
  origin: string,
): string | null {
  if (!m || req.method !== 'GET' || req.range) return null
  const url = new URL(req.url)
  if (url.origin !== origin || url.search) return null
  const hash = m.files[url.pathname]
  return hash ? cacheKey(url.pathname, hash) : null
}

/** Cached keys (full URLs or paths) that no current file uses: safe to delete. */
export function staleKeys(cached: string[], m: Manifest, origin: string): string[] {
  const keep = new Set(Object.entries(m.files).map(([p, h]) => origin + cacheKey(p, h)))
  return cached.filter((k) => !keep.has(k.startsWith('/') ? origin + k : k))
}
