import type * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Grounded } from '../city/layout'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import { matteCard } from '../render/card-normals'
import type { WorldCtx } from './blocks'
import { impostor } from './impostor'
import { instanceParts, modelParts, type Part } from './instancing'
import { instanceByDistance } from './lod-instances'
import { palmVariants } from './palm-model'

const FERN = '/assets/models/vegetation/ph_fern_02.glb'
const PALM = '/assets/models/vegetation/palm.glb'
const PALM_FAR = '/assets/models/vegetation/palm_far.glb'
// Palms draw the 7.5k-triangle model within the first range, the 2k one within the second,
// and a 4-triangle impostor beyond: far palms were most of the beach view's 6M triangles.
const PALM_RANGES = [80, 220]
// Ferns are a meter tall: a few pixels past this, so they are not drawn at all.
const FERN_RANGE = 140

type Update = (eye: THREE.Vector3, reach?: number) => void

/** Spreads spots across variants so neighbors rarely match. */
function plant(ctx: WorldCtx, variants: Part[][], spots: Grounded[]) {
  variants.forEach((parts, i) => {
    const mine = spots.filter((_, k) => k % variants.length === i)
    instanceParts(ctx, parts, mine, { scale: (s) => s.s })
  })
}

/** Ferns, drawn only near the camera. */
function plantFerns(ctx: WorldCtx, variants: Part[][], spots: Grounded[]): Update[] {
  const place = { scale: (s: Grounded) => s.s, ranges: [FERN_RANGE], detail: true }
  return variants.map((parts, i) => {
    const mine = spots.filter((_, k) => k % variants.length === i)
    return instanceByDistance(ctx, [parts, []], mine, place)
  })
}

/** The generated palm, detailed near the camera and decimated far off; procedural ones if it fails. */
async function plantPalms(
  ctx: WorldCtx,
  palms: Grounded[],
  load: (url: string) => Promise<GLTF>,
  gl: THREE.WebGLRenderer,
): Promise<Update> {
  try {
    const [near, far] = await Promise.all([PALM, PALM_FAR].map(load))
    const parts = [modelParts(near.scene), modelParts(far.scene)]
    const place = {
      scale: (s: Grounded) => s.s,
      ranges: PALM_RANGES,
      shadowLevels: 2,
      farChunk: 800,
    }
    return instanceByDistance(ctx, [...parts, impostor(gl, parts[1])], palms, place)
  } catch (err) {
    console.warn('Palm model failed to load, using procedural palms', err)
    plant(ctx, palmVariants(4), palms)
    return () => {}
  }
}

/**
 * The Poly Haven fern file holds four plants side by side; each becomes its own variant.
 * Matte (see matteCard): in full sun the PBR fronds glowed pale yellow on the sand.
 */
function fernVariants(gltf: GLTF): Part[][] {
  const matte = new Map<THREE.Material, THREE.Material>()
  const swap = (m: THREE.Material) => {
    if (!matte.has(m)) matte.set(m, matteCard(m as THREE.MeshStandardMaterial))
    return matte.get(m)!
  }
  return gltf.scene.children.map((child: THREE.Object3D) =>
    modelParts(child).map((p) => ({ ...p, material: swap(p.material) })),
  )
}

/** The city's palms and ferns, plus the palms outside it (`more`). */
export async function plantVegetation(
  ctx: WorldCtx,
  c: Land,
  more: Grounded[],
  load: (url: string) => Promise<GLTF>,
  gl: THREE.WebGLRenderer,
): Promise<Update> {
  const all = [...c.palms, ...more]
  const palms = await plantPalms(ctx, all, load, gl)
  const updates = [palms, ...plantFerns(ctx, fernVariants(await load(FERN)), c.bushes)]
  for (const p of all) {
    const trunk = RAPIER.ColliderDesc.cylinder(2, 0.25)
    ctx.colliders.add(trunk.setTranslation(p.x, p.y + 2, p.z))
  }
  return (eye, reach) => updates.forEach((u) => u(eye, reach))
}
