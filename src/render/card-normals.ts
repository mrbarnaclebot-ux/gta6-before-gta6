import type * as THREE from 'three'

/** The stock normal setup, then the vertex normal as is, whichever face is in view. */
export const KEEP_NORMAL = /* glsl */ `
#include <normal_fragment_begin>
normal = normalize( vNormal );
`

/**
 * Double-sided cards (grass, impostor trees) carry normals that lean up like a canopy's.
 * Three flips the normal on back faces, which turns those down and leaves half the cards
 * black; this keeps them as given. Chains any patch the material already has.
 */
export function keepCardNormals<T extends THREE.Material>(m: T): T {
  const own = m.onBeforeCompile.bind(m)
  m.onBeforeCompile = (shader, renderer) => {
    own(shader, renderer)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      KEEP_NORMAL,
    )
  }
  m.customProgramCacheKey = () => 'card-normals'
  return m
}
