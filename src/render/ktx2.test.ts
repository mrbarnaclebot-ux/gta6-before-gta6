import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// The transcoder must match three's KTX2Loader version: re-copy it after upgrading three.
test('the served Basis transcoder is the one three ships', () => {
  for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
    const ours = readFileSync(`public/assets/basis/${f}`)
    const three = readFileSync(`node_modules/three/examples/jsm/libs/basis/${f}`)
    expect(ours.equals(three), f).toBe(true)
  }
})
