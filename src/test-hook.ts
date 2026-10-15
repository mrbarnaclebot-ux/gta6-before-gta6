import * as THREE from 'three'
import type { FollowCamera } from './camera/follow-camera'
import type { Combat } from './combat/combat'
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
  combat: Combat
  setQuality: (q: Quality) => void
  extra: () => {
    fps: number
    frames: number
    quality: Quality
    drawCalls: number
    triangles: number
  }
}

/** A fresh copy of the game state each call, so callers cannot mutate the game. */
function snapshot(deps: HookDeps) {
  const { player, driving, follow, city, combat, input, extra } = deps
  const { pistol } = combat.shooter
  return {
    position: { x: driving.position.x, y: driving.position.y, z: driving.position.z },
    mode: driving.mode,
    /** Forward speed of the driven car in m/s, 0 on foot. */
    speed: driving.car?.speed ?? 0,
    stalled: driving.car?.stalled ?? false,
    grounded: player.grounded,
    health: player.vitals.health,
    breath: player.vitals.breath,
    underwater: city.underwater,
    ammo: pistol.mag,
    reserve: pistol.reserve,
    reloading: pistol.reloading > 0,
    aiming: combat.shooter.aiming,
    shots: combat.shooter.shots,
    pointerLocked: input.locked,
    camera: follow.camera.position.toArray(),
    ...extra(),
  }
}

/**
 * window.__game: read-only state for Playwright and debugging, plus a few helpers
 * tests need because headless browsers cannot pointer-lock or play by hand.
 */
export function exposeTestHook(deps: HookDeps): void {
  const { driving, follow, city, combat, setQuality } = deps
  const api = {
    state: () => snapshot(deps),
    setQuality,
    /**
     * City landmarks plus `car` (the driver's door of the parked car nearest the spawn)
     * and `range` (the spawn, which faces the target dummies on the beach).
     */
    landmarks: () => {
      const door = driving.door(driving.cars[0])
      const { x, y, z } = city.spawn
      const car = { x: door.x, y: door.y, z: door.z }
      return { ...structuredClone(city.landmarks), car, range: { x, y, z } }
    },
    /** Every car's position, parked or driven. */
    cars: () => driving.cars.map(({ position: p }) => ({ x: p.x, y: p.y, z: p.z })),
    teleport: (x: number, y: number, z: number) => driving.teleport(new THREE.Vector3(x, y, z)),
    /** Target dummies: chest point (feet + 1.2 m) and health. */
    dummies: () =>
      combat.dummies.map(({ feet: f, health }) => ({
        x: f.x,
        y: f.y + 1.2,
        z: f.z,
        health: health.hp,
      })),
    /** Turn the camera so the crosshair sits on a world point. */
    aimAt: (x: number, y: number, z: number) => follow.aimAt(new THREE.Vector3(x, y, z)),
    setCameraYaw: (yaw: number) => (follow.yaw = yaw),
    setCameraPitch: (pitch: number) => (follow.pitch = pitch),
  }
  Object.defineProperty(window, '__game', { value: Object.freeze(api), configurable: true })
}
