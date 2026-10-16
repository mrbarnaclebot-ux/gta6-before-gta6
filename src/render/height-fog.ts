import * as THREE from 'three'

/** Haze thins out with height over this many meters: tower tops stand clear of the street haze. */
export const FOG_SCALE_HEIGHT = 110
// Above this the fog is the underwater murk, which stays even in every direction.
const UNDERWATER_DENSITY = 0.02
/** Forward scattering in the haze toward the sun, for a cosine `fogMu` (sky-dome.ts uses it too). */
export const SUN_HAZE = '( 0.06 * pow( fogMu, 10.0 ) + 0.025 * fogMu * fogMu )'

/**
 * How much thicker (above 1) or thinner (below 1) the haze is along a ray from a camera
 * at height `eye` to a point `dy` meters above it, against haze at sea level: exponential
 * air density integrated along the ray. The shader below does the same per pixel.
 */
export function heightFactor(eye: number, dy: number, scale = FOG_SCALE_HEIGHT): number {
  const base = Math.exp(-Math.max(eye, 0) / scale)
  const k = dy / scale
  return Math.abs(k) < 1e-3 ? base : (base * (1 - Math.exp(-k))) / k
}

const PARS_VERTEX = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying float vFogRise;
#endif
`

// World-space height of the vertex above the camera: the view matrix's rotation is
// orthonormal, so its second column dotted with the view-space position gives it.
const VERTEX = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogRise = dot( viewMatrix[ 1 ].xyz, mvPosition.xyz );
#endif
`

const PARS_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying float vFogRise;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif
`

const FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogK = vFogRise / ${FOG_SCALE_HEIGHT.toFixed(1)};
    float fogBase = exp( - max( cameraPosition.y, 0.0 ) / ${FOG_SCALE_HEIGHT.toFixed(1)} );
    float fogHeight = abs( fogK ) < 1e-3 ? fogBase : fogBase * ( 1.0 - exp( - fogK ) ) / fogK;
    fogHeight = fogDensity > ${UNDERWATER_DENSITY} ? 1.0 : min( fogHeight, 3.0 );
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth * fogHeight );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  vec3 fogLit = fogColor;
  #if defined( RE_Direct ) && NUM_DIR_LIGHTS > 0
    // Sunlight scattered forward by the haze: it glows toward the sun (the sky dome matches).
    float fogMu = max( dot( normalize( - vViewPosition ), directionalLights[ 0 ].direction ), 0.0 );
    float fogAir = fogDensity > ${UNDERWATER_DENSITY} ? 0.0 : 1.0;
    fogLit += directionalLights[ 0 ].color * ${SUN_HAZE} * fogAir;
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogLit, fogFactor );
#endif
`

/**
 * Swaps three's fog for height fog in every material, built-in and custom (the water,
 * the underwater surface): the haze is thickest at sea level and fades with altitude,
 * so distance reads through aerial perspective, not a flat wall. Call before any compile.
 */
export function installHeightFog(): void {
  Object.assign(THREE.ShaderChunk, {
    fog_pars_vertex: PARS_VERTEX,
    fog_vertex: VERTEX,
    fog_pars_fragment: PARS_FRAGMENT,
    fog_fragment: FRAGMENT,
  })
}
