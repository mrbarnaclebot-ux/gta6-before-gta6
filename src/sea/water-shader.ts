import type * as THREE from 'three'
import { SEA_PARS } from './sea-glsl'
import { MAX_WAVE } from './waves'

/*
 * Patches for three's Water: Gerstner waves in the vertex shader, and in the fragment
 * shader depth color and clarity from the sea field plus foam (breakers, the lapping
 * edge, walls and rocks, and whitecaps on offshore crests).
 */

const VERTEX_PARS = /* glsl */ `
${SEA_PARS}
varying vec3 vWaveN;
varying float vLift;
`

const VERTEX = /* glsl */ `
vec4 wp = modelMatrix * vec4( position, 1.0 );
vec3 waveN;
wp.xyz += seaDisplace( wp.xz, seaTime, length( wp.xz - cameraPosition.xz ), waveN );
vWaveN = waveN;
vLift = wp.y - modelMatrix[3].y;
worldPosition = wp;
mirrorCoord = textureMatrix * wp;
vec4 mvPosition = viewMatrix * wp;
gl_Position = projectionMatrix * mvPosition;
`

const FRAGMENT_PARS = /* glsl */ `
${SEA_PARS}
uniform sampler2D foamMap;
uniform vec3 shallowColor;
uniform float waterLight;
varying vec3 vWaveN;
varying float vLift;
vec3 fld;
float waterDepth;
float foamNoise;
`

// Normal-map ripples ride on the wave slope: slopes add for a height field.
const NORMAL = /* glsl */ `
vec3 detailN = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );
vec3 wn = normalize( vWaveN );
vec3 surfaceNormal = normalize( vec3( detailN.x / detailN.y + wn.x / wn.y, 1.0, detailN.z / detailN.y + wn.z / wn.y ) );
fld = seaFieldAt( worldPosition.xz );
waterDepth = fld.x + vLift;
vec2 fuv = worldPosition.xz + surfaceNormal.xz * 0.6;
foamNoise = texture2D( foamMap, fuv * 0.17 + vec2( seaTime * 0.011, seaTime * 0.006 ) ).r * 0.6
  + texture2D( foamMap, fuv * 0.053 - vec2( seaTime * 0.007, -seaTime * 0.009 ) ).r * 0.4;
// Spread to the full 0 to 1 range, so the thresholds below mean coverage.
foamNoise = smoothstep( 0.1, 0.8, foamNoise );
`

const SCATTER = /* glsl */ `
vec3 tint = mix( shallowColor, waterColor, smoothstep( 0.25, 6.0, waterDepth ) );
// Past the shelf the open sea turns a deeper blue.
tint = mix( tint, vec3( 0.012, 0.16, 0.34 ), smoothstep( 12.0, 26.0, waterDepth ) );
vec3 scatter = ( 0.35 + 0.65 * max( 0.0, dot( surfaceNormal, eyeDirection ) ) ) * tint * waterLight;
// Light through the thin wave crests: they glow a brighter green-blue.
scatter *= 1.0 + 0.6 * smoothstep( 0.1, ${MAX_WAVE.toFixed(2)}, vLift );
`

const FOAM = /* glsl */ `
float seaFoam() {
  float shore = fld.y;
  // Lace where the water thins out over the sand, and along walls and rocks.
  // The thinner the water, the more of the bubble pattern shows: solid at the edge, lace behind.
  float e = clamp( waterDepth / 0.07, 0.0, 1.0 );
  float edge = smoothstep( e, e + 0.3, foamNoise ) * ( 1.0 - e );
  // Deep water right against land is a wall or a rock: the swell slaps it white.
  float w = clamp( shore / 1.6, 0.0, 1.0 );
  float wall = smoothstep( w - 0.12, w + 0.04, foamNoise ) * ( 1.0 - w ) * smoothstep( 0.6, 1.5, fld.x );
  edge = max( edge, wall * 0.85 );
  // Breakers: the surf crest turns white in the shallows and leaves a trail that breaks up.
  float ph = seaSurfPhase( worldPosition.xz, seaTime, shore ) / 6.2831853;
  float psi = fract( ph );
  // Real surf breaks in sets with green water between. The crest's own index shifts the
  // gaps, so each crest keeps its pattern all the way in and the next one breaks elsewhere.
  float k = floor( ph + 0.5 );
  vec2 q = worldPosition.xz;
  float sets = sin( 0.09 * q.y + 0.02 * q.x + k * 2.4 ) + sin( 0.13 * q.y - 0.03 * q.x + k * 1.3 );
  float broken = smoothstep( -0.3, 0.5, sets + ( foamNoise - 0.5 ) * 0.8 );
  float breaking = seaSurfBuild( shore ) * ( 1.0 - smoothstep( 0.9, 2.6, fld.x ) ) * broken;
  float trail = smoothstep( psi * 6.0 - 0.04, psi * 6.0 + 0.12, foamNoise ) * ( 1.0 - smoothstep( 0.03, 0.16, psi ) );
  float lip = smoothstep( 0.965, 1.0, psi ) * smoothstep( 0.35, 0.6, foamNoise ) * 0.6;
  float breakers = breaking * max( trail, lip ) * 0.9;
  // Whitecaps: a little foam on the highest offshore crests.
  float caps = smoothstep( 0.45, 0.85, vLift / ${MAX_WAVE.toFixed(2)} ) * smoothstep( 0.55, 0.8, foamNoise ) * 0.55;
  caps *= smoothstep( 4.0, 10.0, fld.x );
  return clamp( max( max( edge, breakers ), caps ), 0.0, 1.0 );
}
`

const OUTPUT = /* glsl */ `
float foam = seaFoam();
// Foam is lit by the sky (its reflection), and the sun's own color: warm and dim at dusk, not paper white.
vec3 foamColor = ( 0.3 + 0.35 * reflectionSample + 0.4 * sunColor * max( dot( sunDirection, surfaceNormal ), 0.0 ) ) * waterLight;
outgoingLight = mix( outgoingLight, foamColor, foam * 0.85 );
// Light crosses more water at grazing angles: far and shallow-angled water goes opaque.
float clarity = mix( 0.22, 0.95, smoothstep( 0.0, 14.0, waterDepth / max( eyeDirection.y, 0.06 ) ) );
// Open-sea depth hides the seabed entirely, so nothing shows where the terrain grid ends.
clarity = max( clarity, smoothstep( 14.0, 24.0, waterDepth ) );
gl_FragColor = vec4( outgoingLight, max( max( clarity, reflectance ), foam ) );
`

/** Rewrites a three.js Water material's shaders in place. */
export function patchWater(mat: THREE.ShaderMaterial): void {
  mat.vertexShader = mat.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERTEX_PARS)
    .replace(
      /mirrorCoord = modelMatrix[\s\S]*?gl_Position = projectionMatrix \* mvPosition;/,
      VERTEX,
    )
  mat.fragmentShader = mat.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAGMENT_PARS + FOAM)
    .replace(/vec3 surfaceNormal = [^;]+;/, NORMAL)
    .replace(/vec3 scatter = [^;]+;/, SCATTER)
    // Keep more body color at grazing angles so the sea reads turquoise, not mirror-silver.
    .replace(
      /reflectionSample \+ specularLight, reflectance \)/,
      'reflectionSample + specularLight, reflectance * 0.6 )',
    )
    // Shadow darkens only the sun-lit part of the body color; full masking turned
    // shaded water into opaque black stains over the seabed.
    .replace('* getShadowMask()', '* mix(0.5, 1.0, getShadowMask())')
    .replace('gl_FragColor = vec4( outgoingLight, alpha );', OUTPUT)
}
