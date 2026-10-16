import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SEA_LEVEL } from '../city/layout'
import { outerLandmarks } from '../land/landmarks'
import type { Land } from '../land/plan'
import { buildingHeight } from '../city/lots'
import { surfaceAt } from '../city/terrain'
import { FLOAT_DEPTH } from '../player/swim'
import type { Ambient } from '../render/sky'
import { buildBeach } from '../scenery/beach'
import { plantDuneGrass } from '../scenery/dune-grass'
import { buildHouses } from '../scenery/houses'
import { buildRoads } from '../scenery/roads'
import { buildTerrain } from '../scenery/terrain'
import { buildVillas } from '../scenery/villas'
import { buildForest } from '../scenery/forest'
import { plantGrass } from '../scenery/grass'
import type { Flora } from '../land/flora'
import { planWorld, type WorldPlan } from '../land/world-plan'
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
import type { V3 } from '../sea/boids'
import { buildSea, planSea, type SeaPlan } from '../sea/sea'

type Point = { x: number; y: number; z: number }
type Load = (url: string) => Promise<GLTF>

export interface City {
  layout: Land
  spawn: THREE.Vector3
  /** Named feet positions for tests and debugging: the beach, a canal bank, a rooftop, downtown. */
  landmarks: Record<string, Point>
  /** Water surface height at (x, z), or null on land. */
  water: (x: number, z: number) => number | null
  /** True while the camera is below the water surface. */
  readonly underwater: boolean
  /** How far the camera is below the surface, 0 above it. */
  readonly underwaterDepth: number
  /** The sea: wave height and its sea life, for tests and debugging. */
  sea: Awaited<ReturnType<typeof buildSea>>
  /** `swimmer`: where the player is while in the water (fish flee it), else null. */
  update(dt: number, camera: THREE.Camera, swimmer?: V3 | null): void
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
function buildNightLights(ctx: WorldCtx, c: Land, windows: THREE.MeshStandardMaterial[]) {
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

/** Everything outside the city grid: terrain, roads, homes, and the beach. Returns the sea plan. */
async function buildScenery(ctx: WorldCtx, plan: WorldPlan): Promise<SeaPlan> {
  const layout = plan.land
  // The sea field comes first: the terrain shader draws the swash and caustics from it.
  const sea = planSea(plan.sea)
  await buildTerrain(ctx, layout, plan.splat, sea.uniforms)
  buildRoads(ctx, layout)
  buildHouses(ctx, layout)
  buildVillas(ctx, layout)
  buildBeach(ctx, layout)
  return sea
}

/** Every plant: palms, ferns, the forest, bushes, rocks, dune grass, and grass. Returns their per-frame update. */
async function buildPlants(
  ctx: WorldCtx,
  layout: Land,
  flora: Flora,
  load: Load,
  gl: THREE.WebGLRenderer,
) {
  const updates = [
    await plantVegetation(ctx, layout, flora.palms, load, gl),
    await buildForest(ctx, gl, load, layout, flora),
    plantDuneGrass(ctx, layout),
    plantGrass(ctx, layout, flora.clear),
  ]
  return (eye: THREE.Vector3, reach: number) => updates.forEach((u) => u(eye, reach))
}

/** The player's start: the plan's spawn spot, set on the ground. */
function spawnPoint(c: Land): THREE.Vector3 {
  const { x, z } = c.spawn
  return new THREE.Vector3(x, surfaceAt(c, x, z) + 0.05, z)
}

/** Generates the seeded city and builds every visual and collider for it. */
export async function buildCity(
  ctx: WorldCtx,
  load: Load,
  light: Ambient,
  gl: THREE.WebGLRenderer,
): Promise<City> {
  const plan = await planWorld()
  const { land: layout, flora } = plan
  buildGround(ctx, layout)
  buildMarkings(ctx, layout)
  buildCanal(ctx, layout)
  const night = buildNightLights(ctx, layout, buildBuildings(ctx, layout))
  const seaPlan = await buildScenery(ctx, plan)
  const sea = await buildSea(ctx, layout, light, load, seaPlan)
  const plants = await buildPlants(ctx, layout, flora, load, gl)
  let reach = 1
  return {
    layout,
    spawn: spawnPoint(layout),
    landmarks: landmarks(layout),
    water: sea.surfaceAt,
    sea,
    get underwater() {
      return sea.underwater.active
    },
    get underwaterDepth() {
      return sea.underwater.depth
    },
    update(dt, camera, swimmer = null) {
      night(light.night, camera.position)
      plants(camera.position, reach)
      sea.update(dt, camera, swimmer)
    },
    setDetail(plants, reflection) {
      reach = plants
      sea.setReflection(reflection)
    },
  }
}
