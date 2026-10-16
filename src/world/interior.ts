import * as THREE from 'three'
import { BAY, FLOOR_H, type Style } from '../city/lots'
import { ROOMS } from './late-textures'

/*
 * Interior mapping: each window looks into a room. A ray from the eye is traced through
 * the glass into a box one bay wide, one floor high and ROOM_DEPTH deep, and where it hits
 * the box is looked up in one of the owner's room pictures (one-point perspective, back wall
 * in the middle third). Every window picks its own room, blinds, and whether its light is on
 * at night, from a hash of the window's center. Window glass turns into real glass: little
 * diffuse, a sharp Fresnel reflection of the sky, and the room seen through it.
 */

/** Glass rect inside one bay/floor cell, matching facades.ts: x, y, w, h as fractions. */
export const GLASS: Record<Style, [number, number, number, number]> = {
  deco: [0.11, 0.29, 0.78, 0.42],
  residential: [0.12, 0.18, 0.76, 0.74],
  glass: [0.0, 0.16, 1.0, 0.84],
}

const ROOM_DEPTH = 3.6
// How deep the glass sits behind the wall face: the jambs and sill show as the view turns.
const REVEAL: Record<Style, number> = { deco: 0.18, residential: 0.14, glass: 0 }
// How much of the room shows through the glass, and the glass's own metalness: tower
// curtain walls are coated and mostly mirror; deco and residential panes are plain glass.
const SEE: Record<Style, number> = { deco: 1, residential: 1, glass: 0.4 }
const METAL: Record<Style, number> = { deco: 0, residential: 0, glass: 0.45 }
// Share of windows lit at night: offices go floor by floor.
const LIT: Record<Style, number> = { deco: 0.45, residential: 0.4, glass: 0.4 }

/** x: daylight (0 to 1), y: night (0 to 1). Set once a frame for every facade. */
export const ROOM_LIGHT = { value: new THREE.Vector2(1, 0) }

const f = (v: number) => v.toFixed(4)

function defines(style: Style): string {
  const [x, y, w, h] = GLASS[style]
  return /* glsl */ `
#define ROOM_GLASS vec4(${[x, y, w, h].map(f).join(', ')})
#define ROOM_SIZE vec3(${f(BAY)}, ${f(FLOOR_H[style])}, ${f(ROOM_DEPTH)})
#define ROOM_SEE ${f(SEE[style])}
#define ROOM_METAL ${f(METAL[style])}
#define ROOM_LIT ${f(LIT[style])}
#define ROOM_REVEAL ${f(REVEAL[style] / ROOM_DEPTH)}
${style === 'glass' ? '#define ROOM_OFFICE' : ''}
`
}

const VERTEX_PARS = /* glsl */ `
varying vec3 vRoomPos;
varying vec3 vRoomN;
varying vec2 vRoomUv;
`
const VERTEX = /* glsl */ `
vRoomPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vRoomN = normalize(mat3(modelMatrix) * objectNormal);
vRoomUv = uv;
`

const FRAGMENT_PARS = /* glsl */ `
precision highp sampler2DArray;
uniform sampler2DArray roomAtlas;
uniform vec2 roomLight;
varying vec3 vRoomPos;
varying vec3 vRoomN;
varying vec2 vRoomUv;
// How much of this pixel is glass, and the light of the room seen through it.
float roomGlass;
vec3 roomSeen;
// 0 near, 1 once windows are only a few pixels wide.
float roomFar;
// 1 where the eye sees the window's jamb, head, or sill instead of the glass.
float roomJamb;

float roomHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

// Atlas layers (late-textures.ts): living, office, hotel, bar, bedroom, kitchen.
float roomLayer(float h) {
#ifdef ROOM_OFFICE
  return h < 0.75 ? 1.0 : (h < 0.9 ? 2.0 : 0.0);
#else
  return h < 0.3 ? 0.0 : (h < 0.5 ? 4.0 : (h < 0.68 ? 5.0 : (h < 0.93 ? 2.0 : 3.0)));
#endif
}

// Offices light whole floors in 24 m runs; homes light window by window.
float roomLit(vec3 center, vec3 id, vec3 t, vec3 n) {
#ifdef ROOM_OFFICE
  vec3 run = vec3(floor(center.y), floor(dot(center, t) / 24.0), dot(n, vec3(3.0, 0.0, 7.0)));
  return step(roomHash(run), ROOM_LIT);
#else
  return step(roomHash(id + 17.17), ROOM_LIT);
#endif
}

/** The room behind this pixel, as a box hit by the eye ray and looked up in its picture. */
vec3 roomLook(vec2 f, vec3 t, vec3 n, float layer, vec2 dx, vec2 dy) {
  vec3 v = vRoomPos - cameraPosition;
  vec3 dir = vec3(dot(v, t), v.y, -dot(v, n)) / ROOM_SIZE;
  vec3 p = vec3(f, 0.0);
  vec2 jamb = abs(dir.xy / dir.z) * ROOM_REVEAL / ROOM_GLASS.zw;
  vec2 wp = (f - ROOM_GLASS.xy) / ROOM_GLASS.zw;
  vec2 side = mix(step(1.0 - jamb, wp), step(wp, jamb), step(dir.xy, vec2(0.0)));
  roomJamb = max(side.x, side.y);
  vec3 hitT = (step(0.0, dir) - p) / dir;
  vec3 hit = clamp(p + dir * min(min(hitT.x, hitT.y), hitT.z), 0.0, 1.0);
  vec2 img = 0.5 + (hit.xy - 0.5) / (1.0 + 2.0 * hit.z);
  return textureGrad(roomAtlas, vec3(img.x, 1.0 - img.y, layer), dx * 0.6, dy * 0.6).rgb;
}

void roomTrace() {
  vec2 cell = vRoomUv * 4.0;
  vec2 dx = dFdx(cell);
  vec2 dy = dFdy(cell);
  // Once a window is a few pixels wide its room blurs to the picture's mean: no shimmer.
  float far = smoothstep(0.12, 0.45, max(length(dx), length(dy)));
  roomFar = far;
  vec2 f = fract(cell);
  vec2 w = (f - ROOM_GLASS.xy) / ROOM_GLASS.zw;
  float inside = step(0.0, w.x) * step(w.x, 1.0) * step(0.0, w.y) * step(w.y, 1.0);
  roomGlass = mix(inside, ROOM_GLASS.z * ROOM_GLASS.w, far);
  roomSeen = vec3(0.0);
  roomJamb = 0.0;
  if (roomGlass < 0.001) return;
  vec3 n = normalize(vRoomN);
  vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
  vec3 center = vRoomPos - t * (f.x - 0.5) * ROOM_SIZE.x;
  center.y -= (f.y - 0.5) * ROOM_SIZE.y;
  vec3 id = floor(center * 2.0 + 0.5);
  float layer = roomLayer(roomHash(id));
  vec3 room = far > 0.99 ? vec3(0.0) : roomLook(f, t, n, layer, dx, dy);
  room = mix(room, textureLod(roomAtlas, vec3(0.5, 0.5, layer), 9.0).rgb, far);
  // Blinds part-way down a third of the windows: plain fabric just behind the glass.
  float b = roomHash(id + 41.3);
  float drop = 0.2 + fract(b * 7.13) * 0.6;
  float blind = step(b, 0.32) * step(1.0 - drop, w.y) * (1.0 - far);
  vec3 fabric = mix(vec3(0.68, 0.63, 0.55), vec3(0.42, 0.43, 0.41), step(0.16, b));
  room = mix(room, fabric * 0.6, blind);
  float lit = roomLit(center, id, t, n);
  float light = roomLight.x * (0.2 + 0.22 * lit) + roomLight.y * mix(0.025, 0.95, lit);
  // Far off, a room is a few dim pixels behind glass that mostly reflects: not a bright tile.
  roomSeen = room * light * ROOM_SEE * (1.0 - 0.5 * far);
  roomJamb *= inside * (1.0 - far);
  roomGlass *= 1.0 - roomJamb;
}
`

const COLOR = /* glsl */ `
#include <color_fragment>
roomTrace();
diffuseColor.rgb = mix(diffuseColor.rgb, vColor.rgb * 0.72, roomJamb);
`
// Mullions and frames inside the glass rect are rough in the facade map: they stay solid.
const ROUGH = /* glsl */ `
#include <metalnessmap_fragment>
roomGlass *= mix(1.0 - smoothstep(0.15, 0.3, roughnessFactor), 1.0, roomFar);
diffuseColor.rgb *= 1.0 - roomGlass * (1.0 - ROOM_METAL) * 0.92;
roughnessFactor = mix(mix(roughnessFactor, 0.03, roomGlass), 0.85, roomJamb);
metalnessFactor = mix(metalnessFactor, ROOM_METAL, roomGlass) * (1.0 - roomJamb);
`
// The room shows through what the glass does not reflect (Schlick, F0 = 0.04).
const EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
float roomCos = clamp(dot(normalize(cameraPosition - vRoomPos), normalize(vRoomN)), 0.0, 1.0);
totalEmissiveRadiance += roomSeen * roomGlass * (0.96 - 0.96 * pow(1.0 - roomCos, 5.0));
`

/** Turns a facade material's window glass into glass with a room behind every pane. */
export function interiorMapped(m: THREE.MeshStandardMaterial, style: Style): void {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.roomAtlas = ROOMS
    shader.uniforms.roomLight = ROOM_LIGHT
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERTEX_PARS}`)
      .replace('#include <fog_vertex>', `${VERTEX}#include <fog_vertex>`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${defines(style)}${FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', COLOR)
      .replace('#include <metalnessmap_fragment>', ROUGH)
      .replace('#include <emissivemap_fragment>', EMISSIVE)
  }
  m.customProgramCacheKey = () => `facade-${style}`
}
