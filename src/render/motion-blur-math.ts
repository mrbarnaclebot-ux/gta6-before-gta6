import * as THREE from 'three'

/** Exposure time the blur imitates, in seconds: a 270-degree shutter at 60 fps. */
export const SHUTTER = 1 / 80
/** Longest streak, as a fraction of the screen, so a fast spin never smears the whole frame. */
export const MAX_BLUR = 0.04
/** View distances, in meters, over which blur fades in: the player and the driven car stay sharp. */
export const SHARP_NEAR = 8
export const FULL_BLUR = 18
/** A camera jump longer than this in one frame is a cut (teleport, respawn), not motion. */
export const CUT_DISTANCE = 8

/**
 * One frame's screen motion covers `dt`; the shutter is open for SHUTTER of it.
 * Clamped so a hitch (long dt) cannot shrink the blur to nothing or a tiny dt blow it up.
 */
export function shutterScale(dt: number, strength: number): number {
  if (dt <= 0) return 0
  return Math.min(2, (SHUTTER / dt) * strength)
}

/** Shortens a 2D vector to at most `max` long. */
export function clampLength(x: number, y: number, max: number): [number, number] {
  const len = Math.hypot(x, y)
  return len > max ? [(x / len) * max, (y / len) * max] : [x, y]
}

/** 0 up close, 1 past FULL_BLUR, smooth in between (GLSL smoothstep). */
export function distanceFade(dist: number): number {
  const t = Math.min(1, Math.max(0, (dist - SHARP_NEAR) / (FULL_BLUR - SHARP_NEAR)))
  return t * t * (3 - 2 * t)
}

const P = new THREE.Vector4()

/**
 * Screen motion (uv per frame) of the static surface seen at `uv` with depth-buffer value
 * `depth`: unproject with this frame's inverse view-projection, reproject with last
 * frame's. The shader does the same per pixel; this copy exists to test the math.
 */
export function screenVelocity(
  uv: [number, number],
  depth: number,
  invViewProj: THREE.Matrix4,
  prevViewProj: THREE.Matrix4,
): [number, number] {
  P.set(uv[0] * 2 - 1, uv[1] * 2 - 1, depth * 2 - 1, 1).applyMatrix4(invViewProj)
  P.divideScalar(P.w).applyMatrix4(prevViewProj)
  return [uv[0] - (P.x / P.w) * 0.5 - 0.5, uv[1] - (P.y / P.w) * 0.5 - 0.5]
}
