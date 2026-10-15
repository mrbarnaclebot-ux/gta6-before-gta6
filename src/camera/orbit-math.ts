export const PITCH_MIN = -0.45
export const PITCH_MAX = 1.25

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch))
}

/** Unit vector from the orbit pivot to the camera. Yaw 0 puts the camera on +Z looking at -Z. */
export function orbitDirection(yaw: number, pitch: number): [number, number, number] {
  const c = Math.cos(pitch)
  return [Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c]
}

/** World-space ground direction for camera-relative input (x right, z forward). */
export function cameraRelative(yaw: number, x: number, z: number): { x: number; z: number } {
  const s = Math.sin(yaw)
  const c = Math.cos(yaw)
  return { x: -s * z + c * x, z: -c * z - s * x }
}

/**
 * Pull the camera in instantly when blocked, ease back out slowly when clear,
 * so walls never clip the view but the camera does not jitter at corners.
 */
export function nextDistance(current: number, allowed: number, dt: number): number {
  if (allowed < current) return allowed
  return Math.min(allowed, current + (allowed - current) * Math.min(1, dt * 4))
}
