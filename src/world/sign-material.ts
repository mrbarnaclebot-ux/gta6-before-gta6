import * as THREE from 'three'
import { ROOM_LIGHT } from './interior'
import { SIGNS } from './late-textures'

const VERTEX_PARS = /* glsl */ `
attribute float sign;
varying vec3 vSign;
`
const FRAGMENT_PARS = /* glsl */ `
precision highp sampler2DArray;
uniform sampler2DArray signAtlas;
uniform vec2 roomLight;
varying vec3 vSign;
vec4 signTex;
`
const MAP = /* glsl */ `
signTex = texture(signAtlas, vec3(vSign.x, 1.0 - vSign.y, vSign.z));
diffuseColor *= signTex;
`
// At night the bright parts of a picture (lit windows, signs, neon) glow; dark paint does not.
const EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += signTex.rgb * signTex.rgb * roomLight.y * 1.6;
`

/**
 * Shopfronts and billboards: a picture from the sign atlas (late-textures.ts), picked per vertex
 * by the `sign` attribute (its layer) and the uv, lit by day and glowing after dark.
 */
export function signMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.signAtlas = SIGNS
    shader.uniforms.roomLight = ROOM_LIGHT
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERTEX_PARS}`)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vSign = vec3(uv, sign);')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAGMENT_PARS}`)
      .replace('#include <map_fragment>', MAP)
      .replace('#include <emissivemap_fragment>', EMISSIVE)
  }
  m.customProgramCacheKey = () => 'sign-atlas'
  return m
}

/** A w x h picture quad standing on its bottom edge at the origin, facing +z, showing `layer`. */
export function signQuad(w: number, h: number, layer: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0)
  const n = geo.attributes.position.count
  geo.setAttribute('sign', new THREE.BufferAttribute(new Float32Array(n).fill(layer), 1))
  return geo
}
