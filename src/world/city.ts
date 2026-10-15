import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { generateCity, SEA_LEVEL, type CityLayout } from '../city/layout'
import { buildingHeight } from '../city/lots'
import { surfaceAt, waterSurfaceAt } from '../city/terrain'
import { FLOAT_DEPTH } from '../player/swim'
import type { WorldCtx } from './blocks'
import { buildBuildings } from './buildings'
import { buildCanal } from './canal'
import { buildGround } from './ground'
import { buildMarkings } from './markings'
import { placeProps } from './props'
import { buildSand } from './sand'
import { plantVegetation } from './vegetation'
import { buildUnderwater } from './underwater'
import { buildWater } from './water'

// ponytail: fixed seed and 1 km size; expose them in settings when the map grows to 2 km.
export const CITY_SEED = 7
export const CITY_SIZE = 1000

type Point = { x: number; y: number; z: number }

export interface City {
  layout: CityLayout
  spawn: THREE.Vector3
  /** Named feet positions for tests and debugging: the beach, a canal bank, a rooftop, downtown. */
  landmarks: Record<string, Point>
  /** Water surface height at (x, z), or null on land. */
  water: (x: number, z: number) => number | null
  /** True while the camera is below the water surface. */
  readonly underwater: boolean
  update(dt: number, camera: THREE.Camera): void
}

function landmarks(c: CityLayout): Record<string, Point> {
  const at = (x: number, z: number, lift = 0) => ({ x, y: surfaceAt(c, x, z) + lift, z })
  const mid = c.zRoads[Math.floor(c.zRoads.length / 2)]
  const tall = c.blocks
    .filter((b) => b.district === 'beachfront')
    .flatMap((b) => b.buildings)
    .reduce((a, b) => (buildingHeight(b) > buildingHeight(a) ? b : a))
  return {
    beach: at(c.land.x1 + 30, mid + 20),
    canal: at(c.canal.x0 - 1.5, mid + 30),
    downtown: at(c.xRoads[1] + 3, mid + 40),
    // The roof's north-west corner: clear of the stair core, and the city lies west.
    ocean: { x: c.land.x1 + 140, y: SEA_LEVEL - FLOAT_DEPTH, z: mid + 20 },
    canalWater: { x: (c.canal.x0 + c.canal.x1) / 2, y: SEA_LEVEL - FLOAT_DEPTH, z: mid + 30 },
    rooftop: {
      x: tall.x - tall.w / 2 + 2.5,
      y: buildingHeight(tall) + 0.3,
      z: tall.z - tall.d / 2 + 2.5,
    },
  }
}

/** Generates the seeded city and builds every visual and collider for it. */
export async function buildCity(
  ctx: WorldCtx,
  load: (url: string) => Promise<GLTF>,
  sunDir: THREE.Vector3,
): Promise<City> {
  const layout = generateCity(CITY_SEED, CITY_SIZE)
  buildGround(ctx, layout)
  buildMarkings(ctx, layout)
  buildCanal(ctx, layout)
  buildBuildings(ctx, layout)
  buildSand(ctx, layout)
  const water = buildWater(ctx, layout, sunDir)
  placeProps(ctx, layout)
  await plantVegetation(ctx, layout, load)
  const waterAt = (x: number, z: number) => waterSurfaceAt(layout, x, z)
  const underwater = buildUnderwater(ctx.scene, water.surface, (x, z) => waterAt(x, z) !== null)
  const { x, z } = layout.spawn
  return {
    layout,
    spawn: new THREE.Vector3(x, surfaceAt(layout, x, z) + 0.05, z),
    landmarks: landmarks(layout),
    water: waterAt,
    get underwater() {
      return underwater.active
    },
    update(dt, camera) {
      water.update(dt)
      underwater.update(camera, dt)
    },
  }
}
