import * as THREE from 'three'
import * as csmModule from 'three/examples/jsm/csm/CSMShader.js'

// @types/three declares CSMShader as a type only; the module exports the object.
const { CSMShader } = csmModule as unknown as { CSMShader: { lights_fragment_begin: string } }

// Captured at import, before any CSM swaps the chunks.
const STOCK = {
  fragment: THREE.ShaderChunk.lights_fragment_begin,
  pars: THREE.ShaderChunk.lights_pars_begin,
}
const DIR = '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )'
const UNIFORMS = /* glsl */ `
#if defined( USE_CSM ) && defined( CSM_CASCADES )
uniform vec2 CSM_cascades[CSM_CASCADES];
uniform float cameraNear;
uniform float shadowFar;
#endif
`

/** Three's current light chunk with only its directional-light block swapped for CSM's. */
function csmFragment(): string {
  const src = CSMShader.lights_fragment_begin
  const start = src.indexOf(`${DIR} && defined( USE_CSM )`)
  const end = src.indexOf(`${DIR} && !defined( USE_CSM )`)
  if (start < 0 || end < 0 || !STOCK.fragment.includes(DIR)) {
    throw new Error('CSM shader chunks no longer match this three.js version')
  }
  const plain = `${DIR} && !defined( USE_CSM ) && !defined( CSM_CASCADES )`
  return STOCK.fragment.replace(DIR, src.slice(start, end) + plain)
}

/**
 * CSM installs its own full copy of three's light chunk, which has fallen behind r186:
 * it lacks the multi-scattering DFG term, so every metal (the glass towers) renders black.
 * Call right after creating a CSM to put back the current chunk with only CSM's cascade
 * selection spliced in. Materials without USE_CSM compile exactly as stock.
 */
export function installCsmChunks(): void {
  THREE.ShaderChunk.lights_fragment_begin = csmFragment()
  THREE.ShaderChunk.lights_pars_begin = UNIFORMS + STOCK.pars
}
