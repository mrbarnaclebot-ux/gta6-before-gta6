import * as THREE from 'three'
import type { FollowCamera } from './camera/follow-camera'
import { surfaceAt } from './city/terrain'
import type { Combat } from './combat/combat'
import type { Input } from './input/input'
import { RESPAWN_AFTER, type Life } from './life/life'
import { cooling, stars } from './life/wanted'
import { groundProbe } from './life/traffic'
import type { PhysicsWorld } from './physics'
import type { Player } from './player/player'
import type { Sky } from './render/sky'
import { PRESETS, type Graphics, type Preset } from './render/graphics'
import type { Driving } from './vehicle/driving'
import type { City } from './world/city'
import type { Ui } from './ui/hud-sync'

interface HookDeps {
  physics: PhysicsWorld
  player: Player
  driving: Driving
  follow: FollowCamera
  input: Input
  city: City
  combat: Combat
  life: Life
  sky: Sky
  clock: { hours: number }
  setGraphics: (g: Graphics) => void
  graphics: () => Graphics
  paused: () => boolean
  ui: Pick<Ui, 'worldMap' | 'nav'>
  extra: () => {
    fps: number
    frames: number
    quality: Preset | 'custom'
    drawCalls: number
    triangles: number
  }
}

const xyz = (p: THREE.Vector3) => ({ x: p.x, y: p.y, z: p.z })

/** A fresh copy of the game state each call, so callers cannot mutate the game. */
function snapshot(deps: HookDeps) {
  const { player, driving, follow, city, combat, input, life, sky, clock, extra } = deps
  const { pistol } = combat.shooter
  return {
    position: xyz(driving.position),
    mode: driving.mode,
    /** Forward speed of the driven car in m/s, 0 on foot. */
    speed: driving.car?.speed ?? 0,
    stalled: driving.car?.stalled ?? false,
    grounded: player.grounded,
    health: player.vitals.health,
    breath: player.vitals.breath,
    dead: life.dead,
    wanted: stars(life.wanted),
    wantedCooling: cooling(life.wanted),
    hours: clock.hours,
    night: sky.ambient.night,
    /** Unit vector toward the sun by day, the moon by night. */
    sun: sky.ambient.sunDir.toArray(),
    paused: deps.paused(),
    mapOpen: deps.ui.worldMap.open,
    sensitivity: follow.sensitivity,
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

/** Visible people and traffic, for checks on what the player can see. */
function actorHelpers({ life }: HookDeps) {
  return {
    /** Visible people: chest point (feet + 1.2 m), health, and state. */
    peds: () =>
      life.crowd.people
        .filter((p) => p.root.visible)
        .map((p) => ({
          ...xyz(p.position),
          y: p.position.y + 1.2,
          health: p.health.hp,
          state: p.state,
        })),
    /** Visible traffic cars: a stable id, position, speed in m/s, health, and whether it is police. */
    traffic: () =>
      life.traffic.cars.flatMap((c, id) =>
        c.visual.root.visible
          ? [
              {
                id,
                ...xyz(c.position),
                speed: c.speed,
                health: c.health.hp,
                police: c.visual.police,
              },
            ]
          : [],
      ),
  }
}

/**
 * How far each parked car, traffic car, and visible person stands above (+) or sunk into (-)
 * the solid ground found by a ray straight down: null where no ground was found.
 */
function groundGaps({ physics, driving, life }: HookDeps) {
  const probe = groundProbe(physics)
  const gap = (kind: string, p: THREE.Vector3) => {
    const g = probe(p.x, p.y, p.z)
    return { kind, x: p.x, y: p.y, z: p.z, gap: g === null ? null : p.y - g }
  }
  return () => [
    ...driving.cars.map((c) => gap('parked', c.position)),
    ...life.traffic.cars.filter((c) => c.visual.root.visible).map((c) => gap('traffic', c.feet)),
    ...life.crowd.people.filter((p) => p.root.visible).map((p) => gap('person', p.position)),
  ]
}

/** Helpers for death and the clock. */
function lifeHelpers(deps: HookDeps) {
  const { life, player, clock, sky } = deps
  return {
    hospitals: () => life.hospitals.map((h) => ({ ...h })),
    /** Take damage, as from a fall. Enough of it kills. */
    hurt: (amount: number) => {
      player.vitals.health = Math.max(0, player.vitals.health - amount)
    },
    /** Skip the rest of the death screen: wake up at the hospital next frame. */
    skipDeath: () => {
      if (life.deadFor !== null) life.deadFor = RESPAWN_AFTER
    },
    /** Jump the clock to an hour from 0 to 24. */
    setTime: (hours: number) => {
      clock.hours = ((hours % 24) + 24) % 24
      sky.setTime(clock.hours)
    },
  }
}

/**
 * window.__game: read-only state for Playwright and debugging, plus a few helpers
 * tests need because headless browsers cannot pointer-lock or play by hand.
 */
export function exposeTestHook(deps: HookDeps): void {
  const { setGraphics, graphics } = deps
  const api = {
    state: () => snapshot(deps),
    /** Switch to a quality preset, as the settings menu does. */
    setQuality: (p: Preset) => setGraphics({ ...PRESETS[p] }),
    /** A copy of the current graphics settings. */
    graphics: () => ({ ...graphics() }),
    /** Change some graphics settings, keeping the rest. */
    setGraphics: (patch: Partial<Graphics>) => setGraphics({ ...graphics(), ...patch }),
    ...worldHelpers(deps),
    ...actorHelpers(deps),
    ...lifeHelpers(deps),
    groundGaps: groundGaps(deps),
  }
  Object.defineProperty(window, '__game', { value: Object.freeze(api), configurable: true })
}

/** Places, the camera, targets, and the GPS route. */
function worldHelpers(deps: HookDeps) {
  const { driving, follow, city, combat } = deps
  return {
    /**
     * City landmarks plus `car` (the driver's door of the parked car nearest the spawn)
     * and `range` (the spawn, which faces the target dummies on the beach).
     */
    landmarks: () => {
      const door = driving.door(driving.cars[0])
      return { ...structuredClone(city.landmarks), car: xyz(door), range: xyz(city.spawn) }
    },
    /** Every parked or driven car's position. */
    cars: () => driving.cars.map(({ position }) => xyz(position)),
    teleport: (x: number, y: number, z: number) => driving.teleport(new THREE.Vector3(x, y, z)),
    /** Walkable ground height at (x, z): terrain, or the city's sidewalks and roads. */
    ground: (x: number, z: number) => surfaceAt(city.layout, x, z),
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
    /** The waypoint and the GPS route to it (road points ending at the waypoint), or null. */
    waypoint: () => {
      const { target, path } = deps.ui.nav
      return target && { ...target, route: path.map((p) => ({ ...p })) }
    },
  }
}
