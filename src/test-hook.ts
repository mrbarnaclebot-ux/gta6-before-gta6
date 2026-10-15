import * as THREE from 'three'
import type { FollowCamera } from './camera/follow-camera'
import type { Input } from './input/input'
import type { Player } from './player/player'
import type { Quality } from './settings'

interface HookDeps {
  player: Player
  follow: FollowCamera
  input: Input
  setQuality: (q: Quality) => void
  landmarks: Record<string, { x: number; y: number; z: number }>
  extra: () => {
    fps: number
    frames: number
    quality: Quality
    drawCalls: number
    triangles: number
  }
}

/**
 * window.__game: read-only state for Playwright and debugging, plus a few helpers
 * tests need because headless browsers cannot pointer-lock or play by hand.
 * state() returns a fresh copy each call so callers cannot mutate the game.
 */
export function exposeTestHook(deps: HookDeps): void {
  const { player, follow, input, setQuality, extra } = deps
  const api = {
    state: () => ({
      position: { x: player.position.x, y: player.position.y, z: player.position.z },
      mode: 'walking' as const,
      grounded: player.grounded,
      health: 100,
      ammo: 0,
      pointerLocked: input.locked,
      camera: follow.camera.position.toArray(),
      ...extra(),
    }),
    setQuality,
    landmarks: () => structuredClone(deps.landmarks),
    teleport: (x: number, y: number, z: number) => player.teleport(new THREE.Vector3(x, y, z)),
    setCameraYaw: (yaw: number) => (follow.yaw = yaw),
    setCameraPitch: (pitch: number) => (follow.pitch = pitch),
  }
  Object.defineProperty(window, '__game', { value: Object.freeze(api), configurable: true })
}
