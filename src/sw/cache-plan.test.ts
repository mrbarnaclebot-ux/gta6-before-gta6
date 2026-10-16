import { describe, expect, it } from 'vitest'
import { cacheKey, keyFor, staleKeys, type Manifest } from './cache-plan'

const O = 'https://game.test'
const m: Manifest = {
  build: 'b1',
  files: { '/assets/a.glb': 'h1', '/build/game-x.js': 'h2' },
}
const get = (path: string, range: string | null = null) => ({
  method: 'GET',
  url: O + path,
  range,
})

describe('service worker cache plan', () => {
  it('keys known files by path and content hash', () => {
    expect(keyFor(m, get('/assets/a.glb'), O)).toBe('/assets/a.glb?v=h1')
    expect(keyFor(m, get('/build/game-x.js'), O)).toBe(cacheKey('/build/game-x.js', 'h2'))
  })

  it('leaves everything else to the network', () => {
    expect(keyFor(null, get('/assets/a.glb'), O)).toBeNull()
    expect(keyFor(m, get('/'), O)).toBeNull()
    expect(keyFor(m, get('/assets/new.glb'), O)).toBeNull()
    expect(keyFor(m, get('/assets/a.glb', 'bytes=0-'), O)).toBeNull()
    expect(keyFor(m, { ...get('/assets/a.glb'), method: 'POST' }, O)).toBeNull()
    expect(keyFor(m, get('/assets/a.glb?x=1'), O)).toBeNull()
    expect(
      keyFor(m, { ...get('/assets/a.glb'), url: 'https://cdn.test/assets/a.glb' }, O),
    ).toBeNull()
  })

  it('a changed file misses its old copy, which is then stale', () => {
    const next: Manifest = { build: 'b2', files: { ...m.files, '/assets/a.glb': 'h3' } }
    const cached = [O + '/assets/a.glb?v=h1', O + '/build/game-x.js?v=h2']
    expect(keyFor(next, get('/assets/a.glb'), O)).toBe('/assets/a.glb?v=h3')
    expect(staleKeys(cached, next, O)).toEqual([O + '/assets/a.glb?v=h1'])
    expect(staleKeys(cached, m, O)).toEqual([])
  })
})
