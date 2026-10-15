import * as THREE from 'three'
import type { FollowCamera } from './camera/follow-camera'
import type { Input } from './input/input'
import type { Player } from './player/player'
import type { Driving } from './vehicle/driving'
import type { Quality } from './settings'
import type { City } from './world/city'

interface HookDeps {
  player: Player
  driving: Driving
  follow: FollowCamera
  input: Input
  city: City
  setQuality: (q: Quality) => void
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
  const { player, driving, follow, city, input, setQuality, extra } = deps
  const api = {
    state: () => ({
      position: { x: driving.position.x, y: driving.position.y, z: driving.position.z },
      mode: driving.mode,
      /** Forward speed of the driven car in m/s, 0 on foot. */
      speed: driving.car?.speed ?? 0,
      stalled: driving.car?.stalled ?? false,
      grounded: player.grounded,
      health: player.vitals.health,
      breath: player.vitals.breath,
      underwater: city.underwater,
      ammo: 0,
      pointerLocked: input.locked,
      camera: follow.camera.position.toArray(),
      ...extra(),
    }),
    setQuality,
    /** City landmarks plus `car`: the driver's door of the parked car nearest the spawn. */
    landmarks: () => {
      const door = driving.door(driving.cars[0])
      return { ...structuredClone(city.landmarks), car: { x: door.x, y: door.y, z: door.z } }
    },
    /** Every car's position, parked or driven. */
    cars: () => driving.cars.map(({ position: p }) => ({ x: p.x, y: p.y, z: p.z })),
    teleport: (x: number, y: number, z: number) => driving.teleport(new THREE.Vector3(x, y, z)),
    setCameraYaw: (yaw: number) => (follow.yaw = yaw),
    setCameraPitch: (pitch: number) => (follow.pitch = pitch),
  }
  Object.defineProperty(window, '__game', { value: Object.freeze(api), configurable: true })
}
