// Vite plugin for production builds: writes dist/asset-manifest.json (a content hash for every
// file, read by the service worker) and precompressed .br/.gz copies that Caddy serves as is.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import type { Plugin } from 'vite'

// Never cached by the service worker: the pages, the worker itself, and the manifest.
const UNCACHED = new Set(['/index.html', '/terms.html', '/sw.js', '/asset-manifest.json'])
// Already compressed formats (jpg, webp, mp3, ktx2, png, woff2) gain nothing.
const COMPRESSIBLE = /\.(js|css|html|json|md|svg|glb|bin|hdr|wasm)$/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const hash = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex').slice(0, 12)

function precompress(file: string, buf: Buffer) {
  if (!COMPRESSIBLE.test(file) || buf.length < 1024) return
  const br = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } })
  const gz = gzipSync(buf, { level: 9 })
  if (br.length < buf.length * 0.9) writeFileSync(`${file}.br`, br)
  if (gz.length < buf.length * 0.9) writeFileSync(`${file}.gz`, gz)
}

export function assetManifest(): Plugin {
  let outDir = 'dist'
  return {
    name: 'asset-manifest',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const files: Record<string, string> = {}
      for (const file of walk(outDir).filter((f) => !/\.(br|gz)$/.test(f))) {
        const path = '/' + relative(outDir, file).split(sep).join('/')
        const buf = readFileSync(file)
        if (!UNCACHED.has(path)) files[path] = hash(buf)
        precompress(file, buf)
      }
      const build = hash(JSON.stringify(files))
      writeFileSync(join(outDir, 'asset-manifest.json'), JSON.stringify({ build, files }))
    },
  }
}
