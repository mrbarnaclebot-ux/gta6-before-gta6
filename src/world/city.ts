import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SEA_LEVEL, type CityLayout } from '../city/layout'
import { outerLandmarks } from '../land/landmarks'
import { generateLand, type Land } from '../land/plan'
import { buildingHeight } from '../city/lots'
import { surfaceAt, waterSurfaceAt } from '../city/terrain'
import { FLOAT_DEPTH } from '../player/swim'
import type { Ambient } from '../render/sky'
import { buildBeach } from '../scenery/beach'
import { plantDuneGrass } from '../scenery/dune-grass'
import { buildHouses } from '../scenery/houses'
import { buildRoads } from '../scenery/roads'
import { buildTerrain } from '../scenery/terrain'
import { buildVillas } from '../scenery/villas'
import type { WorldCtx } from './blocks'
import { buildBuildings } from './buildings'
import { buildCanal } from './canal'
import { hospitals } from '../life/places'
import { buildGround } from './ground'
import { buildHospitalSigns } from './hospital-signs'
import { buildMarkings } from './markings'
import { buildNeon } from './neon'
import { placeProps } from './props'
import { buildStreetGlow } from './street-glow'
import { plantVegetation } from './vegetation'
import { buildUnderwater } from './underwater'
import { buildWater } from './water'

// The city core is 1 km square; the land plan grows the world around it to about 2 x 2 km.
export const CITY_SEED = 7
export const CITY_SIZE = 1000

type Point = { x: number; y: number; z: number }

export interface City {
  layout: Land
  spawn: THREE.Vector3
  /** Named feet positions for tests and debugging: the beach, a canal bank, a rooftop, downtown. */
  landmarks: Record<string, Point>
  /** Water surface height at (x, z), or null on land. */
  water: (x: number, z: number) => number | null
  /** True while the camera is below the water surface. */
  readonly underwater: boolean
  update(dt: number, camera: THREE.Camera): void
  /** Render distance: `plants` scales palm detail and fern ranges; `reflection` is the sea mirror size. */
  setDetail(plants: number, reflection: number): void
}

function landmarks(c: Land): Record<string, Point> {
  const at = (x: number, z: number, lift = 0) => ({ x, y: surfaceAt(c, x, z) + lift, z })
  const mid = c.zRoads[Math.floor(c.zRoads.length / 2)]
  const tall = c.blocks
    .filter((b) => b.district === 'beachfront')
    .flatMap((b) => b.buildings)
    .reduce((a, b) => (buildingHeight(b) > buildingHeight(a) ? b : a))
  return {
    ...outerLandmarks(c),
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

/** Everything that lights up after dark: windows, neon, street lamps, hospital signs. */
function buildNightLights(ctx: WorldCtx, c: CityLayout, windows: THREE.MeshStandardMaterial[]) {
  const neon = buildNeon(ctx, c)
  const glow = buildStreetGlow(ctx, c, placeProps(ctx, c))
  const signs = buildHospitalSigns(ctx, hospitals(c))
  return (k: number, focus: THREE.Vector3) => {
    for (const w of windows) w.emissiveIntensity = 1.3 * k
    signs.emissiveIntensity = 0.1 + 1.6 * k
    neon.setNight(k)
    glow.update(k, focus)
  }
}

/** Generates the seeded city and builds every visual and collider for it. */
export async function buildCity(
  ctx: WorldCtx,
  load: (url: string) => Promise<GLTF>,
  light: Ambient,
  gl: THREE.WebGLRenderer,
): Promise<City> {
  const layout = generateLand(CITY_SEED, CITY_SIZE)
  buildGround(ctx, layout)
  buildMarkings(ctx, layout)
  buildCanal(ctx, layout)
  const night = buildNightLights(ctx, layout, buildBuildings(ctx, layout))
  await buildTerrain(ctx, layout)
  buildRoads(ctx, layout)
  buildHouses(ctx, layout)
  buildVillas(ctx, layout)
  buildBeach(ctx, layout)
  const dunes = plantDuneGrass(ctx, layout)
  const water = buildWater(ctx, layout, light)
  const palms = await plantVegetation(ctx, layout, load, gl)
  const waterAt = (x: number, z: number) => waterSurfaceAt(layout, x, z)
  const wet = (x: number, z: number) => waterAt(x, z) !== null
  const underwater = buildUnderwater(ctx.scene, water.surface, water.normals, wet)
  const { x, z } = layout.spawn
  let reach = 1
  return {
    layout,
    spawn: new THREE.Vector3(x, surfaceAt(layout, x, z) + 0.05, z),
    landmarks: landmarks(layout),
    water: waterAt,
    get underwater() {
      return underwater.active
    },
    update(dt, camera) {
      night(light.night, camera.position)
      palms(camera.position, reach)
      dunes(camera.position, reach)
      water.update(dt)
      underwater.update(camera, dt, light.day)
    },
    setDetail(plants, reflection) {
      reach = plants
      water.setReflection(reflection)
    },
  }
}
