import type * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { CityLayout, Spot } from '../city/layout'
import { surfaceAt } from '../city/terrain'
import { RAPIER } from '../physics'
import type { WorldCtx } from './blocks'
import { instanceParts, modelParts, type Part } from './instancing'
import { instanceByDistance } from './lod-instances'
import { palmVariants } from './palm-model'

const FERN = '/assets/models/vegetation/ph_fern_02.glb'
const PALM = '/assets/models/vegetation/palm.glb'
const PALM_FAR = '/assets/models/vegetation/palm_far.glb'
// Palms farther than this draw the 2k-triangle version instead of the 7.5k one.
const PALM_LOD = 80
// Ferns are a meter tall: a few pixels past this, so they are not drawn at all.
const FERN_RANGE = 140

type Update = (eye: THREE.Vector3) => void

/** Spreads spots across variants so neighbors rarely match. */
function plant(ctx: WorldCtx, c: CityLayout, variants: Part[][], spots: Spot[]) {
  const ground = (s: Spot) => surfaceAt(c, s.x, s.z)
  variants.forEach((parts, i) => {
    const mine = spots.filter((_, k) => k % variants.length === i)
    instanceParts(ctx, parts, mine, { scale: (s) => s.s, ground })
  })
}

/** Ferns, drawn only near the camera. */
function plantFerns(ctx: WorldCtx, c: CityLayout, variants: Part[][], spots: Spot[]): Update[] {
  const ground = (s: Spot) => surfaceAt(c, s.x, s.z)
  const place = { scale: (s: Spot) => s.s, ground, far: FERN_RANGE, detail: true }
  return variants.map((parts, i) => {
    const mine = spots.filter((_, k) => k % variants.length === i)
    return instanceByDistance(ctx, parts, [], mine, place)
  })
}

/** The generated palm, detailed near the camera and decimated far off; procedural ones if it fails. */
async function plantPalms(
  ctx: WorldCtx,
  c: CityLayout,
  load: (url: string) => Promise<GLTF>,
): Promise<Update> {
  const ground = (s: Spot) => surfaceAt(c, s.x, s.z)
  try {
    const [near, far] = await Promise.all([PALM, PALM_FAR].map(load))
    const parts = [modelParts(near.scene), modelParts(far.scene)]
    const place = { scale: (s: Spot) => s.s, ground, far: PALM_LOD }
    return instanceByDistance(ctx, parts[0], parts[1], c.palms, place)
  } catch (err) {
    console.warn('Palm model failed to load, using procedural palms', err)
    plant(ctx, c, palmVariants(4), c.palms)
    return () => {}
  }
}

/** The Poly Haven fern file holds four plants side by side; each becomes its own variant. */
function fernVariants(gltf: GLTF): Part[][] {
  return gltf.scene.children.map((child: THREE.Object3D) => modelParts(child))
}

export async function plantVegetation(
  ctx: WorldCtx,
  c: CityLayout,
  load: (url: string) => Promise<GLTF>,
): Promise<Update> {
  const palms = await plantPalms(ctx, c, load)
  const updates = [palms, ...plantFerns(ctx, c, fernVariants(await load(FERN)), c.bushes)]
  for (const p of c.palms) {
    const trunk = RAPIER.ColliderDesc.cylinder(2, 0.25)
    ctx.physics.createCollider(trunk.setTranslation(p.x, surfaceAt(c, p.x, p.z) + 2, p.z))
  }
  return (eye) => updates.forEach((u) => u(eye))
}
